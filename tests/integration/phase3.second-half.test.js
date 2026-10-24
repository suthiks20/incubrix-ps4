/**
 * Verifies the remaining Integration Standard API workflows without external platform keys.
 * Jobs are processed against the in-process test database and local connector mocks.
 */
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { afterAll, beforeAll, beforeEach, describe, expect, test } = require('@jest/globals');
const { runPending } = require('../../src/modules/jobs/worker');
const { createContext, resetJobs, createDestination, jobPayload, workerDeps } = require('./jobs/helpers');
const { runBatch } = require('../../dist/scripts/ix-batch');
const { seedDemoDestinations } = require('../../src/modules/seed/demo');

async function batchSamples() {
  const directory = path.join(process.cwd(), 'samples', 'batch');
  const files = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  return Promise.all(files.map(async (name) => JSON.parse(
    await fs.readFile(path.join(directory, name), 'utf8')
  )));
}

async function seedBatch(ctx) {
  await seedDemoDestinations(ctx.knex, ctx.app.config, ctx.mockRoot);
}

async function runBatchJob(ctx, inputs, key) {
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/v1/jobs',
    headers: { 'idempotency-key': key },
    payload: { type: 'batch_publish', input: { items: inputs } }
  });
  expect(response.statusCode).toBe(202);
  await runPending(workerDeps(ctx));
  return ctx.app.inject(`/api/v1/jobs/${response.json().job_id}`);
}

describe('Phase 3 Integration Standard', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await createContext();
  });

  beforeEach(async () => {
    await resetJobs(ctx);
  });

  afterAll(async () => {
    await ctx.close();
  });

  test('ix-batch writes summary.json and one result per input', async () => {
    const batchCtx = await createContext({ apiToken: 'fake-test-token' });
    const input = await fs.mkdtemp(path.join(os.tmpdir(), 'ix-batch-input-'));
    const destination = await createDestination(batchCtx, 'discourse', 'normal');
    const output = path.join(batchCtx.directory, 'batch-output');
    await fs.writeFile(path.join(input, 'success.json'), JSON.stringify(jobPayload(destination.id)));
    await fs.writeFile(path.join(input, 'rejected.json'), JSON.stringify({ type: 'missing', input: {} }));

    let active = true;
    const worker = (async () => {
      while (active) {
        await runPending(workerDeps(batchCtx));
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    })();

    try {
      const summary = await runBatch({
        input,
        out: output,
        api: `http://127.0.0.1:${batchCtx.port}`,
        token: 'fake-test-token'
      });
      expect(summary).toEqual(expect.objectContaining({ total: 2, passed: 1, failed: 1 }));
      expect(summary.results).toHaveLength(2);
      const outputFiles = await fs.readdir(output);
      expect(outputFiles.filter((name) => name.endsWith('-manifest.json'))).toHaveLength(1);
      expect(outputFiles.filter((name) => /^\d{3}-(success|rejected)\.json$/.test(name))).toHaveLength(2);
      expect(outputFiles).toContain('summary.json');
      expect(JSON.parse(await fs.readFile(path.join(output, 'summary.json'), 'utf8')).total).toBe(2);
    } finally {
      active = false;
      await worker;
      await fs.rm(input, { recursive: true, force: true });
      await batchCtx.close();
    }
  });

  test('ix-batch loads the eight hard-case sample inputs', async () => {
    const samples = await batchSamples();
    const cases = samples.map((sample) => sample.input.items[0].case);
    expect(samples).toHaveLength(8);
    expect(cases).toEqual(expect.arrayContaining([
      'expired_token',
      'rate_limited',
      'spec_violation',
      'frequency_cap',
      'no_promo_forum'
    ]));
  });

  test('batch_publish returns the expected outcome for each sample input', async () => {
    const batchCtx = await createContext({ config: { CONNECTOR_HTTP_TIMEOUT_MS: 300 } });
    await seedBatch(batchCtx);
    const samples = await batchSamples();
    try {
      const response = await runBatchJob(
        batchCtx,
        samples.flatMap((sample) => sample.input.items),
        'phase9-batch-all'
      );
      expect(response.json()).toEqual(expect.objectContaining({ status: 'succeeded' }));
      expect(response.json().result.items).toHaveLength(8);
      expect(response.json().result.items.filter((item) => !item.passed)).toEqual([]);
      expect(response.json().result.items.map((item) => item.code)).toEqual(expect.arrayContaining([
        'PLATFORM_UNAVAILABLE',
        'PLATFORM_RATE_LIMIT',
        'CONNECTION_AUTH_EXPIRED',
        'DEST_SPEC_VIOLATION',
        'DEST_RULE_FREQUENCY_CAP',
        'DEST_RULE_VIOLATION',
        'SCHEMA_DRIFT'
      ]));
    } finally {
      await batchCtx.close();
    }
  });

  test('ix-batch eight sample inputs each match their expected outcome', async () => {
    const batchCtx = await createContext({ config: { CONNECTOR_HTTP_TIMEOUT_MS: 300 } });
    await seedBatch(batchCtx);
    const input = path.join(process.cwd(), 'samples', 'batch');
    const output = path.join(batchCtx.directory, 'batch-samples');
    let active = true;
    const worker = (async () => {
      while (active) {
        await runPending(workerDeps(batchCtx));
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    })();
    try {
      const summary = await runBatch({
        input,
        out: output,
        api: `http://127.0.0.1:${batchCtx.port}`
      });
      expect(summary).toEqual(expect.objectContaining({ total: 8, passed: 8, failed: 0 }));
      const outputFiles = await fs.readdir(output);
      expect(outputFiles.filter((name) => name.endsWith('-report.json'))).toHaveLength(8);
      for (const entry of summary.results) {
        const result = JSON.parse(await fs.readFile(entry.output_path, 'utf8'));
        expect(result.status).toBe('succeeded');
        expect(result.result.items).toHaveLength(1);
        expect(result.result.items[0].passed).toBe(true);
      }
    } finally {
      active = false;
      await worker;
      await batchCtx.close();
    }
  });

  test('batch_publish leaves no test posts behind', async () => {
    const batchCtx = await createContext({ config: { CONNECTOR_HTTP_TIMEOUT_MS: 300 } });
    await seedBatch(batchCtx);
    try {
      const samples = await batchSamples();
      const response = await runBatchJob(
        batchCtx,
        samples.flatMap((sample) => sample.input.items),
        'phase9-batch-cleanup'
      );
      expect(response.json()).toEqual(expect.objectContaining({ status: 'succeeded' }));
      const scenarios = [
        ['discourse', 'timeout_after_success'],
        ['discourse', 'rate_limit_long'],
        ['discourse', 'expired_token'],
        ['discourse', 'sim-weekly-cap'],
        ['discourse', 'sim-media-rejected'],
        ['discourse', 'sim-no-promo'],
        ['lemmy', 'renamed_field']
      ];
      for (const [connector, scenario] of scenarios) {
        const state = await fetch(`${batchCtx.mockRoot}/${connector}/${scenario}/_state`).then((value) => value.json());
        expect((state.posts || []).filter((post) => !post.deleted)).toHaveLength(0);
      }
    } finally {
      await batchCtx.close();
    }
  });

  test('ix-batch accepts a single JSON input file', async () => {
    const input = path.join(ctx.directory, 'single-input.json');
    const output = path.join(ctx.directory, 'single-output');
    await fs.writeFile(input, JSON.stringify({ type: 'unknown', input: {} }));

    const summary = await runBatch({ input, out: output, api: `http://127.0.0.1:${ctx.port}` });

    expect(summary).toEqual(expect.objectContaining({ total: 1, passed: 0, failed: 1 }));
    expect(await fs.readdir(output)).toEqual(expect.arrayContaining(['001-single-input.json', 'summary.json']));
  });

  test('E2E full path with no API keys', async () => {
    const baseUrl = `${ctx.mockRoot}/discourse/normal`;
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/destinations',
      headers: { 'idempotency-key': 'phase3-e2e-destination' },
      payload: {
        name: 'In-process Discourse',
        url: baseUrl,
        platform_key: 'discourse',
        connector_key: 'discourse',
        language: 'en',
        config: { base_url: baseUrl }
      }
    });
    expect(created.statusCode).toBe(201);
    const destination = created.json();
    const connection = { api_key: 'fake-test-key', api_username: 'test-user' };
    const published = await ctx.app.inject({
      method: 'POST',
      url: '/connector/v1/discourse/publish',
      headers: { 'idempotency-key': 'phase3-e2e-publish' },
      payload: {
        destination_id: destination.id,
        connection,
        rendition: { title: 'A sufficiently long title', body: 'A helpful test post.' }
      }
    });
    expect(published.statusCode).toBe(200);
    const platformPostId = published.json().platform_post_id;

    const status = await ctx.app.inject({
      method: 'POST',
      url: '/connector/v1/discourse/get_status',
      payload: { destination_id: destination.id, connection, platform_post_id: platformPostId }
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().status).toBe('published');

    const deleted = await ctx.app.inject({
      method: 'POST',
      url: '/connector/v1/discourse/delete',
      payload: { destination_id: destination.id, connection, platform_post_id: platformPostId }
    });
    expect(deleted.statusCode).toBe(200);

    const createdJob = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/jobs',
      headers: { 'idempotency-key': 'phase3-e2e-certify' },
      payload: jobPayload(destination.id)
    });
    expect(createdJob.statusCode).toBe(202);
    await runPending(workerDeps(ctx));
    const jobId = createdJob.json().job_id;
    const job = await ctx.app.inject({ method: 'GET', url: `/api/v1/jobs/${jobId}` });
    expect(job.json()).toEqual(expect.objectContaining({ status: 'succeeded', progress: 100 }));
    expect(job.json().links.manifest).toBe(`/api/v1/jobs/${jobId}/download/manifest`);

    const manifest = await ctx.app.inject({ method: 'GET', url: job.json().links.manifest });
    expect(manifest.statusCode).toBe(200);
    expect(JSON.parse(manifest.body)).toEqual(expect.objectContaining({
      providers: expect.any(Array),
      timings: expect.any(Object),
      cost_estimate: expect.any(Object)
    }));
  });

  test('.env.example lists every config setting', async () => {
    const configPath = path.join(process.cwd(), 'src/config/index.ts');
    const envPath = path.join(process.cwd(), '.env.example');
    const configSource = await fs.readFile(configPath, 'utf8');
    const envExample = await fs.readFile(envPath, 'utf8');
    const configInterface = configSource.match(/interface AppConfig\s*\{([\s\S]*?)\n\}/);
    expect(configInterface).not.toBeNull();
    const settings = [...configInterface[1].matchAll(/^\s*([A-Z][A-Z0-9_]+):/gm)].map((match) => match[1]);
    const documented = new Set([...envExample.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]));
    expect(settings.filter((setting) => !documented.has(setting))).toEqual([]);
  });

  test('public discovery routes return service links without a token', async () => {
    const publicCtx = await createContext({ apiToken: 'fake-protected-token' });
    try {
      const root = await publicCtx.app.inject('/');
      expect(root.statusCode).toBe(200);
      expect(root.json()).toEqual(expect.objectContaining({
        name: expect.any(String),
        version: expect.any(String),
        mode: 'simulation',
        links: expect.objectContaining({
          health: '/health',
          ready: '/ready',
          openapi: '/openapi.yaml',
          reviewer_guide: expect.stringContaining('README')
        })
      }));
      expect(JSON.stringify(root.json())).not.toContain('fake-protected-token');
      const openapi = await publicCtx.app.inject('/openapi.yaml');
      expect(openapi.statusCode).toBe(200);
      expect(openapi.headers['content-type']).toContain('yaml');
      expect(openapi.body).toContain('openapi: 3.1.0');
    } finally {
      await publicCtx.close();
    }
  });

  test('batch_publish report is linked with the output manifest', async () => {
    const batchCtx = await createContext({ config: { CONNECTOR_HTTP_TIMEOUT_MS: 300 } });
    await seedBatch(batchCtx);
    try {
      const sample = (await batchSamples())[3].input.items[0];
      const response = await runBatchJob(batchCtx, [sample], 'phase9-batch-report');
      const links = response.json().links;
      expect(links.report).toBe(`/api/v1/jobs/${response.json().job_id}/download/report`);
      expect(links.manifest).toBe(`/api/v1/jobs/${response.json().job_id}/download/manifest`);
      const report = await batchCtx.app.inject(links.report);
      expect(report.json()).toEqual(expect.objectContaining({ total: 1, passed: 1 }));
    } finally {
      await batchCtx.close();
    }
  });
});
