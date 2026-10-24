/**
 * Verifies demo seeding and the self-test job against the local simulation connectors.
 * No test creates posts on a real platform or changes real certification evidence.
 */
const { afterEach, beforeEach, describe, expect, test } = require('@jest/globals');
const { seedDemoDestinations } = require('../../src/modules/seed/demo');
const { runPending } = require('../../src/modules/jobs/worker');
const { createContext, resetJobs, workerDeps } = require('./jobs/helpers');

describe('Phase 4 self-test and demo seed', () => {
  let ctx;

  beforeEach(async () => {
    ctx = await createContext({ config: { RATE_LIMIT_PER_MINUTE: 10000 } });
    await resetJobs(ctx);
  });

  afterEach(async () => {
    await ctx.close();
  });

  async function seed() {
    return seedDemoDestinations(ctx.knex, ctx.app.config, ctx.mockRoot);
  }

  async function runSelftest(key = 'phase4-selftest') {
    await seed();
    const accepted = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/selftest',
      headers: { 'idempotency-key': key }
    });
    await runPending(workerDeps(ctx));
    const job = await ctx.app.inject(`/api/v1/jobs/${accepted.json().job_id}`);
    return { accepted, job };
  }

  test('selftest reports every hard case with an expected and actual code', async () => {
    const { accepted, job } = await runSelftest('phase4-report');
    const cases = job.json().result.cases;
    expect(accepted.statusCode).toBe(202);
    expect(job.json().status).toBe('succeeded');
    expect(cases).toHaveLength(14);
    expect(cases.filter((item) =>
      typeof item.expected_code !== 'string' ||
      typeof item.actual_code !== 'string' ||
      typeof item.what_the_system_did !== 'string' ||
      !item.passed
    )).toEqual([]);
  });

  test('selftest leaves zero stale test posts', async () => {
    await runSelftest('phase4-cleanup');
    const scenarios = [
      ['discourse', 'timeout_after_success'],
      ['discourse', 'rate_limit'],
      ['discourse', 'expired_token'],
      ['discourse', 'content_rejected'],
      ['discourse', 'sim-no-promo'],
      ['discourse', 'sim-weekly-cap'],
      ['discourse', 'sim-needs-disclosure'],
      ['discourse', 'sim-media-rejected'],
      ['lemmy', 'renamed_field'],
      ['lemmy', 'sim-non-english'],
      ['webhook', 'partner_revoked']
    ];
    for (const [connector, scenario] of scenarios) {
      const response = await ctx.app.inject(`/mock/${connector}/${scenario}/_state`);
      const state = response.json();
      expect(state.posts || state.articles).toHaveLength(0);
    }
  });

  test('selftest is idempotent under the same Idempotency-Key', async () => {
    await seed();
    const request = {
      method: 'POST',
      url: '/api/v1/selftest',
      headers: { 'idempotency-key': 'phase4-idempotent' }
    };
    const first = await ctx.app.inject(request);
    const replay = await ctx.app.inject(request);
    await runPending(workerDeps(ctx));
    const jobs = await ctx.knex('jobs').where({ type: 'selftest' });
    expect(first.json().job_id).toBe(replay.json().job_id);
    expect(replay.headers['idempotent-replay']).toBe('true');
    expect(jobs).toHaveLength(1);
  });

  test('seed is idempotent', async () => {
    const firstCount = await seed();
    const firstRows = await ctx.knex('destinations').select('id', 'name').orderBy('name');
    const secondCount = await seed();
    const secondRows = await ctx.knex('destinations').select('id', 'name').orderBy('name');
    expect(firstCount).toBe(17);
    expect(secondCount).toBe(firstCount);
    expect(secondRows).toEqual(firstRows);
  });

  test('seed is skipped when simulation mode is disabled', async () => {
    const count = await seedDemoDestinations(
      ctx.knex,
      { ...ctx.app.config, SIMULATION_MODE: false },
      ctx.mockRoot
    );
    expect(count).toBe(0);
    expect(await ctx.knex('destinations').count({ total: '*' }).first()).toEqual({ total: '0' });
  });

  test('seeded destinations each trigger their intended rule or error code', async () => {
    const { job } = await runSelftest('phase4-intended-codes');
    const byCase = Object.fromEntries(job.json().result.cases.map((item) => [item.case, item]));
    const expectations = {
      timeout_then_retry: 'PLATFORM_UNAVAILABLE',
      rate_limit_reset_honored: 'PLATFORM_RATE_LIMIT',
      expired_token: 'CONNECTION_AUTH_EXPIRED',
      content_rejected: 'PLATFORM_CONTENT_REJECTED',
      title_too_long: 'DEST_SPEC_VIOLATION',
      body_too_long: 'DEST_SPEC_VIOLATION',
      media_not_accepted: 'DEST_SPEC_VIOLATION',
      second_post_inside_frequency_cap: 'DEST_RULE_FREQUENCY_CAP',
      promotion_to_no_promo_destination: 'DEST_RULE_VIOLATION',
      renamed_field_demotes_destination: 'SCHEMA_DRIFT',
      partner_revokes_permission: 'CONNECTION_AUTH_EXPIRED',
      non_english_community_mismatch: 'DEST_RULE_VIOLATION',
      ai_disclosure_auto_appended: 'AI_DISCLOSURE_APPENDED',
      csv_duplicates_bad_urls_mixed_languages: 'CATALOGUE_IMPORT_COMPLETED'
    };
    for (const [caseName, code] of Object.entries(expectations)) {
      expect(byCase[caseName]).toEqual(expect.objectContaining({
        expected_code: code,
        actual_code: code,
        passed: true
      }));
    }
  });

  test('selftest job links the downloadable report and output manifest', async () => {
    const { job } = await runSelftest('phase4-downloads');
    const links = job.json().links;
    expect(links.report).toBe(`/api/v1/jobs/${job.json().job_id}/download/report`);
    expect(links.manifest).toBe(`/api/v1/jobs/${job.json().job_id}/download/manifest`);
    expect((await ctx.app.inject(links.report)).json()).toHaveLength(14);
    expect((await ctx.app.inject(links.manifest)).statusCode).toBe(200);
  });

  test('selftest route returns a queued 202 job', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/selftest',
      headers: { 'idempotency-key': 'phase4-queued' }
    });
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      job_id: expect.any(String),
      status: 'queued',
      progress: 0
    });
  });

  test('selftest can run one reviewer case without changing the default full run', async () => {
    const { job } = await runSelftest('phase4-selected-case');
    const request = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/selftest',
      headers: { 'idempotency-key': 'phase4-selected-timeout' },
      payload: { case: 'timeout_then_retry' }
    });
    await runPending(workerDeps(ctx));
    const selected = await ctx.app.inject(`/api/v1/jobs/${request.json().job_id}`);
    expect(job.json().result.cases).toHaveLength(14);
    expect(selected.json().result.cases).toEqual([
      expect.objectContaining({
        case: 'timeout_then_retry',
        expected_code: 'PLATFORM_UNAVAILABLE',
        actual_code: 'PLATFORM_UNAVAILABLE',
        passed: true
      })
    ]);
  });

  test('seed does not create destinations outside simulation mode', async () => {
    const count = await seedDemoDestinations(
      ctx.knex,
      { ...ctx.app.config, SIMULATION_MODE: false },
      ctx.mockRoot
    );
    expect(count).toBe(0);
    expect(await ctx.knex('destinations').count('* as total').first().then((row) => Number(row.total)))
      .toBe(0);
  });
});
