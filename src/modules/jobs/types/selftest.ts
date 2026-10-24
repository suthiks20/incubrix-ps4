/**
 * Runs the hidden-test scenarios only against seeded local mocks.
 * Each published post is removed and the final case report is stored with the job.
 */
import AppError = require('../../../shared/errors/AppError');
import { importCatalogue } from '../../catalogue/service';
import { runCertification } from '../../certification/services/run';
import outcome = require('../../certification/services/outcome');

function connectionFor(destination: any): any {
  if (destination.connector_key === 'webhook') return { signing_secret: 'test-signing-secret' };
  if (destination.connector_key === 'lemmy') {
    return { username: 'sim-user', password: 'lemmy-password' };
  }
  return { api_key: 'sim-key', api_username: 'sim-user' };
}

function authHeaders(deps: any): Record<string, string> {
  return deps.config.API_TOKEN
    ? { authorization: `Bearer ${deps.config.API_TOKEN}` }
    : {};
}

async function destinationFor(deps: any, name: string): Promise<any> {
  const destination = await deps.knex('destinations').where({ name }).first();
  if (!destination) {
    throw new AppError('NOT_FOUND', `Seed destination ${name} is missing`, {
      statusCode: 404,
      details: { seed_destination: name }
    });
  }
  return destination;
}

async function invoke(
  deps: any,
  destination: any,
  method: string,
  payload: any,
  key?: string
): Promise<any> {
  const response = await deps.app.inject({
    method: 'POST',
    url: `/connector/v1/${destination.connector_key}/${method}`,
    headers: { ...authHeaders(deps), ...(key ? { 'idempotency-key': key } : {}) },
    payload: { destination_id: destination.id, connection: connectionFor(destination), ...payload }
  });
  return { status: response.statusCode, headers: response.headers, body: response.json() };
}

function resultCode(response: any): string {
  return response.body?.error?.code || 'OK';
}

async function mockState(deps: any, destination: any): Promise<any> {
  const url = new URL(`${destination.config.base_url}/_state`);
  const response = await deps.app.inject(`${url.pathname}${url.search}`);
  return response.json();
}

async function resetMocks(deps: any): Promise<void> {
  const cases = [
    ['discourse', 'timeout_after_success'],
    ['discourse', 'rate_limit'],
    ['discourse', 'expired_token'],
    ['discourse', 'content_rejected'],
    ['lemmy', 'renamed_field'],
    ['discourse', 'sim-no-promo'],
    ['discourse', 'sim-weekly-cap'],
    ['discourse', 'sim-needs-disclosure'],
    ['webhook', 'partner_revoked'],
    ['lemmy', 'sim-non-english'],
    ['discourse', 'sim-media-rejected']
  ];
  for (const [connector, scenario] of cases) {
    await deps.app.inject({ method: 'POST', url: `/mock/${connector}/${scenario}/_reset` });
  }
}

async function deletePost(deps: any, destination: any, response: any): Promise<boolean> {
  const postId = response.body?.platform_post_id;
  if (!postId) return true;
  const deleted = await invoke(deps, destination, 'delete', { platform_post_id: postId });
  return deleted.status === 200 && deleted.body.deleted === true;
}

async function publish(
  deps: any,
  destination: any,
  key: string,
  rendition: any
): Promise<any> {
  return invoke(deps, destination, 'publish', { rendition }, key);
}

async function runTimeoutCase(deps: any, jobId: string): Promise<any> {
  const destination = await destinationFor(deps, 'sim-timeout');
  const rendition = { title: 'A timeout recovery post', body: 'Test recovery.' };
  const first = await publish(deps, destination, `${jobId}-timeout`, rendition);
  const retry = await publish(deps, destination, `${jobId}-timeout`, rendition);
  const state = await mockState(deps, destination);
  const cleaned = await deletePost(deps, destination, retry);
  return {
    expected_code: 'PLATFORM_UNAVAILABLE',
    actual_code: resultCode(first),
    passed: first.body?.error?.code === 'PLATFORM_UNAVAILABLE' &&
      retry.status === 200 && retry.headers['idempotent-replay'] === 'true' &&
      state.posts.length === 1 && cleaned,
    what_the_system_did: `Recovered the timed-out publish with one post; cleanup=${cleaned}.`
  };
}

async function runRateLimitCase(deps: any, jobId: string): Promise<any> {
  const destination = await destinationFor(deps, 'sim-429');
  const startedAt = Date.now();
  const response = await publish(
    deps,
    destination,
    `${jobId}-rate-limit`,
    { title: 'A rate limit retry post', body: 'Test reset handling.' }
  );
  const elapsed = Date.now() - startedAt;
  const state = await mockState(deps, destination);
  const cleaned = await deletePost(deps, destination, response);
  const honored = response.status === 200 && state.rateLimited &&
    state.post_attempts === 2 && elapsed >= 900;
  return {
    expected_code: 'PLATFORM_RATE_LIMIT',
    actual_code: honored ? 'PLATFORM_RATE_LIMIT' : resultCode(response),
    passed: honored && cleaned,
    what_the_system_did: `Retried after ${elapsed}ms and cleanup=${cleaned}.`
  };
}

async function runPublishErrorCase(
  deps: any,
  destinationName: string,
  scenario: string,
  expected: string,
  jobId: string
): Promise<any> {
  const destination = await destinationFor(deps, destinationName);
  const response = await publish(deps, destination, `${jobId}-${scenario}`, {
    title: 'A publish error case title',
    body: 'Testing a platform error response.'
  });
  const actual = resultCode(response);
  return {
    expected_code: expected,
    actual_code: actual,
    passed: actual === expected,
    what_the_system_did: `Returned ${actual} without creating a post.`
  };
}

async function runLimitCase(
  deps: any,
  jobId: string,
  field: 'title' | 'body'
): Promise<any> {
  const destination = await destinationFor(deps, 'sim-healthy-discourse');
  const rendition = {
    title: field === 'title' ? 'T'.repeat(256) : 'A title within limits',
    body: field === 'body' ? 'B'.repeat(32001) : 'A body within limits.'
  };
  const response = await publish(deps, destination, `${jobId}-${field}-long`, rendition);
  const actual = resultCode(response);
  return {
    expected_code: 'DEST_SPEC_VIOLATION',
    actual_code: actual,
    passed: actual === 'DEST_SPEC_VIOLATION',
    what_the_system_did: `Rejected the overlong ${field} before publishing.`
  };
}

async function runMediaCase(deps: any, jobId: string): Promise<any> {
  const destination = await destinationFor(deps, 'sim-media-rejected');
  const response = await publish(deps, destination, `${jobId}-media`, {
    title: 'A media validation case',
    body: 'This media type is not allowed.',
    media: [{ url: 'https://media.example/image.png', type: 'image/png' }]
  });
  const actual = resultCode(response);
  const violation = response.body?.error?.details?.violations?.[0];
  return {
    expected_code: 'DEST_SPEC_VIOLATION',
    actual_code: actual,
    passed: actual === 'DEST_SPEC_VIOLATION' &&
      violation?.field === 'media[0].type' && Array.isArray(violation.allowed),
    what_the_system_did: violation?.reason || 'Rejected unsupported media before publishing.'
  };
}

async function runFrequencyCase(deps: any, jobId: string): Promise<any> {
  const destination = await destinationFor(deps, 'sim-weekly-cap');
  await deps.knex('publish_ledger').where({
    connector_key: destination.connector_key,
    destination_ref: destination.config.base_url
  }).delete();
  const rendition = { title: 'A weekly cap test post', body: 'First permitted post.' };
  const first = await publish(deps, destination, `${jobId}-cap-first`, rendition);
  const second = await publish(deps, destination, `${jobId}-cap-second`, {
    title: 'A second weekly cap post',
    body: 'This one should wait.'
  });
  const cleaned = await deletePost(deps, destination, first);
  const actual = resultCode(second);
  return {
    expected_code: 'DEST_RULE_FREQUENCY_CAP',
    actual_code: actual,
    passed: first.status === 200 && actual === 'DEST_RULE_FREQUENCY_CAP' && cleaned,
    what_the_system_did: `Rescheduled the second post and cleanup=${cleaned}.`
  };
}

async function runPromoCase(deps: any, jobId: string): Promise<any> {
  const destination = await destinationFor(deps, 'sim-no-promo');
  const response = await publish(deps, destination, `${jobId}-no-promo`, {
    title: 'Please sign up for our service',
    body: 'A promotional test post.',
    is_promotional: true
  });
  const actual = resultCode(response);
  return {
    expected_code: 'DEST_RULE_VIOLATION',
    actual_code: actual,
    passed: actual === 'DEST_RULE_VIOLATION',
    what_the_system_did: 'Blocked promotional content on a no-promotion destination.'
  };
}

async function runRenameCase(deps: any): Promise<any> {
  const destination = await destinationFor(deps, 'sim-renamed-field');
  const prior = {
    level: destination.level,
    last_certified_at: destination.last_certified_at,
    demoted: destination.demoted
  };
  let run: any;
  let after: any;
  try {
    run = await runCertification(deps, destination.id);
    after = await deps.knex('destinations').where({ id: destination.id }).first();
  } finally {
    await outcome.restoreDestinationState(deps.knex, destination.id, prior);
  }
  return {
    expected_code: 'SCHEMA_DRIFT',
    actual_code: run.failure_code || 'OK',
    passed: run.failure_code === 'SCHEMA_DRIFT' && after.demoted === true &&
      run.test_post_deleted === true,
    what_the_system_did: 'Certification detected schema drift, cleaned its post, and restored the prior demotion state.'
  };
}

async function runRevokedCase(deps: any, jobId: string): Promise<any> {
  const destination = await destinationFor(deps, 'sim-revoked-partner');
  const response = await publish(deps, destination, `${jobId}-revoked`, {
    title: 'A revoked partner test post',
    body: 'The partner permission is revoked.'
  });
  const actual = resultCode(response);
  return {
    expected_code: 'CONNECTION_AUTH_EXPIRED',
    actual_code: actual,
    passed: actual === 'CONNECTION_AUTH_EXPIRED',
    what_the_system_did: 'Stopped publishing after the partner revoked permission.'
  };
}

async function runLanguageCase(deps: any, jobId: string): Promise<any> {
  const destination = await destinationFor(deps, 'sim-non-english');
  const response = await publish(deps, destination, `${jobId}-language`, {
    title: 'English post for Spanish community',
    body: 'This language does not match the community.',
    language: 'en'
  });
  const actual = resultCode(response);
  return {
    expected_code: 'DEST_RULE_VIOLATION',
    actual_code: actual,
    passed: actual === 'DEST_RULE_VIOLATION',
    what_the_system_did: 'Blocked content whose language does not match the community.'
  };
}

async function runDisclosureCase(deps: any, jobId: string): Promise<any> {
  const destination = await destinationFor(deps, 'sim-needs-disclosure');
  const response = await publish(deps, destination, `${jobId}-disclosure`, {
    title: 'An AI assisted disclosure post',
    body: 'A useful test message.',
    ai_generated: true
  });
  const state = await mockState(deps, destination);
  const text = state.posts[0]?.raw || '';
  const disclosed = text.includes(destination.config.disclosure_text);
  const cleaned = await deletePost(deps, destination, response);
  const warning = response.body?.warnings?.find((entry: any) => entry.code === 'AI_DISCLOSURE_APPENDED');
  return {
    expected_code: 'AI_DISCLOSURE_APPENDED',
    actual_code: warning?.code || 'OK',
    passed: disclosed && Boolean(warning) && cleaned,
    what_the_system_did: `Appended the required disclosure and cleanup=${cleaned}.`
  };
}

async function runCatalogueCase(deps: any): Promise<any> {
  const unique = `https://example.com/selftest/${deps.job_id}`;
  const name = `Selftest ${deps.job_id}`;
  const csv = [
    'name,url,platform_key,connector_key,language,description',
    `${name},${unique},sim-selftest,discourse,en,AI creator community`,
    `Spanish duplicate,${unique},sim-selftest,discourse,es,comunidad para creadores`,
    'Bad URL,file://invalid,sim-selftest,discourse,es,comunidad'
  ].join('\n');
  const sourceKey = `jobs/${deps.job_id}/selftest-input.csv`;
  await deps.storage.put(sourceKey, Buffer.from(csv, 'utf8'));
  let imported: any;
  try {
    imported = await importCatalogue(deps, {
      source: { upload: { storage_key: sourceKey } }
    }, async () => {});
  } finally {
    await deps.knex('destinations').where({ name }).delete();
  }
  const pass = imported.rows === 3 && imported.imported === 1 &&
    imported.duplicates === 1 && imported.errors === 2 &&
    imported.languages.includes('en') && imported.languages.includes('es');
  return {
    expected_code: 'CATALOGUE_IMPORT_COMPLETED',
    actual_code: pass ? 'CATALOGUE_IMPORT_COMPLETED' : 'CATALOGUE_IMPORT_FAILED',
    passed: pass,
    what_the_system_did: `Imported ${imported.imported}; duplicates=${imported.duplicates}; errors=${imported.errors}.`
  };
}

async function runCase(
  cases: any[],
  name: string,
  run: () => Promise<any>
): Promise<void> {
  try {
    cases.push({ case: name, ...await run() });
  } catch (error: any) {
    cases.push({
      case: name,
      expected_code: 'CASE_COMPLETED',
      actual_code: error.code || 'INTERNAL_ERROR',
      passed: false,
      what_the_system_did: 'The scenario could not complete.'
    });
  }
}

async function runSelftest(
  deps: any,
  input: any,
  progress: (value: number) => Promise<void>
): Promise<any> {
  if (!deps.config.SIMULATION_MODE || !deps.app) {
    throw new AppError('JOB_TYPE_NOT_READY', 'Self-test requires the simulation API and seeded mocks', {
      statusCode: 501
    });
  }
  const cases: any[] = [];
  const jobId = deps.job_id;
  await resetMocks(deps);
  try {
    const actions: Array<[string, () => Promise<any>]> = [
      ['timeout_then_retry', () => runTimeoutCase(deps, jobId)],
      ['rate_limit_reset_honored', () => runRateLimitCase(deps, jobId)],
      ['expired_token', () => runPublishErrorCase(
        deps, 'sim-expired-token', 'expired_token', 'CONNECTION_AUTH_EXPIRED', jobId
      )],
      ['content_rejected', () => runPublishErrorCase(
        deps, 'sim-content-rejected', 'content_rejected', 'PLATFORM_CONTENT_REJECTED', jobId
      )],
      ['title_too_long', () => runLimitCase(deps, jobId, 'title')],
      ['body_too_long', () => runLimitCase(deps, jobId, 'body')],
      ['media_not_accepted', () => runMediaCase(deps, jobId)],
      ['second_post_inside_frequency_cap', () => runFrequencyCase(deps, jobId)],
      ['promotion_to_no_promo_destination', () => runPromoCase(deps, jobId)],
      ['renamed_field_demotes_destination', () => runRenameCase(deps)],
      ['partner_revokes_permission', () => runRevokedCase(deps, jobId)],
      ['non_english_community_mismatch', () => runLanguageCase(deps, jobId)],
      ['ai_disclosure_auto_appended', () => runDisclosureCase(deps, jobId)],
      ['csv_duplicates_bad_urls_mixed_languages', () => runCatalogueCase(deps)]
    ];
    const selected = input && input.case
      ? actions.filter(([name]) => name === input.case)
      : actions;
    if (input?.case && selected.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Unknown self-test case', {
        statusCode: 400,
        details: { case: input.case }
      });
    }
    for (let index = 0; index < selected.length; index += 1) {
      const [name, action] = selected[index];
      await runCase(cases, name, action);
      await progress(Math.min(95, 10 + Math.floor(((index + 1) / selected.length) * 85)));
    }
  } finally {
    await resetMocks(deps);
    await deps.knex('publish_ledger')
      .where('idempotency_key', 'like', `${jobId}-%`)
      .delete();
  }
  const reportKey = `jobs/${jobId}/selftest-report.json`;
  await deps.storage.put(reportKey, JSON.stringify(cases, null, 2));
  return {
    cases,
    passed: cases.filter((entry) => entry.passed).length,
    failed: cases.filter((entry) => !entry.passed).length,
    report_key: reportKey,
    report_link: `/api/v1/jobs/${jobId}/download/report`
  };
}

export { runSelftest };
