/**
 * Exercises the connector contract against the in-process Discourse simulator.
 * A real PostgreSQL test database verifies that publish recovery survives requests.
 */
const buildApp = require('../../src/app');
const { createTestDatabase } = require('./testDatabase');
const pino = require('pino');
const { PassThrough } = require('stream');
const loggerOptions = require('../../src/shared/logger');

let app;
let knex;
let baseUrl;
let connection;
beforeAll(async () => {
  knex = createTestDatabase();
  app = buildApp({ knex, apiToken: '' });
  await app.listen({ port: 0, host: '127.0.0.1' });
  baseUrl = `http://127.0.0.1:${app.server.address().port}/mock/discourse/normal`;
  connection = { api_key: 'unit-secret-key', api_username: 'tester' };
});
beforeEach(async () => { await knex('publish_ledger').del(); await fetch(`${baseUrl}/_reset`, { method: 'POST' }); });
afterAll(async () => { await app.close(); await knex.destroy(); });
function payload(key, options = {}) { return { idempotency_key: key, destination_ref: baseUrl, connection, rendition: { title: options.title || 'A sufficiently long title', body: 'Hello forum' } }; }
test('publishes once and replays completed results with a stable identity', async () => {
  const first = await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: payload('roundtrip-1') });
  expect(first.statusCode).toBe(200);
  const again = await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: payload('roundtrip-1') });
  expect(again.statusCode).toBe(200);
  expect(again.json().platform_post_id).toBe(first.json().platform_post_id);
  expect(again.headers['idempotent-replay']).toBe('true');
  expect((await fetch(`${baseUrl}/_state`).then((r) => r.json())).posts).toHaveLength(1);
});
test('rejects changed requests and missing idempotency keys', async () => {
  await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: payload('changed-1') });
  const conflict = await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: payload('changed-1', { title: 'Another sufficiently long title' }) });
  expect(conflict.statusCode).toBe(409);
  expect(conflict.json().error.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
  const missing = await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: { destination_ref: baseUrl, rendition: {} } });
  expect(missing.statusCode).toBe(400);
  expect(missing.json().error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
});
test('returns a validation envelope and connector catalogue', async () => {
  const invalid = await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: payload('invalid-1', { title: 'A'.repeat(256) }) });
  expect(invalid.json()).toMatchObject({ error: { code: 'DEST_SPEC_VIOLATION', retryable: false, details: { violations: expect.any(Array) } } });
  expect((await app.inject('/api/v1/connectors')).json()[0].key).toBe('discourse');
});

test('reconciles a response lost after the platform created the post', async () => {
  const destination = { ...payload('timeout-1'), destination_ref: baseUrl.replace('/normal', '/timeout_after_success') };
  const first = await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: destination });
  expect(first.statusCode).toBe(503);
  expect(first.json().error.code).toBe('PLATFORM_UNAVAILABLE');
  expect((await knex('publish_ledger').where({ idempotency_key: 'timeout-1' }).first()).state).toBe('unknown');
  const retry = await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: destination });
  expect(retry.statusCode).toBe(200);
  expect(retry.headers['idempotent-replay']).toBe('true');
  expect((await fetch(destination.destination_ref + '/_state').then((r) => r.json())).posts).toHaveLength(1);
});

test('maps authentication, content, and schema errors from the platform', async () => {
  for (const [scenario, code, status] of [['expired_token', 'CONNECTION_AUTH_EXPIRED', 401], ['revoked', 'CONNECTION_AUTH_EXPIRED', 401], ['content_rejected', 'PLATFORM_CONTENT_REJECTED', 422], ['renamed_field', 'SCHEMA_DRIFT', 502]]) {
    const request = payload(`mapped-${scenario}`);
    request.destination_ref = baseUrl.replace('/normal', `/${scenario}`);
    const result = await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: request });
    expect(result.statusCode).toBe(status);
    expect(result.json()).toMatchObject({ error: { code, message: expect.any(String), retryable: expect.any(Boolean), details: expect.any(Object) } });
    if (scenario === 'content_rejected') expect(result.json().error.details.platform_message).toBe('Title is too short');
    if (scenario === 'renamed_field') expect(result.json().error.details.missing_fields).toContain('topic_id');
  }
});

test('honors short and long rate limits', async () => {
  const short = payload('rate-short');
  short.destination_ref = baseUrl.replace('/normal', '/rate_limit');
  const shortResult = await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: short });
  expect(shortResult.statusCode).toBe(200);
  expect((await fetch(`${short.destination_ref}/_state`).then((r) => r.json())).post_attempts).toBe(2);
  const long = payload('rate-long');
  long.destination_ref = baseUrl.replace('/normal', '/rate_limit_long');
  const longResult = await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: long });
  expect(longResult.statusCode).toBe(429);
  expect(longResult.headers['retry-after']).toBe('120');
  expect(longResult.json().error.code).toBe('PLATFORM_RATE_LIMIT');
});

test('does not log or persist connection credentials on success or failure', async () => {
  let output = '';
  const stream = new PassThrough();
  stream.on('data', (chunk) => { output += chunk.toString(); });
  const secretApp = buildApp({ knex, apiToken: '', logger: pino({ ...loggerOptions, level: 'info' }, stream) });
  const secret = 'connector-secret-very-unique';
  try {
    const failing = payload('secret-fail');
    failing.destination_ref = baseUrl.replace('/normal', '/expired_token');
    failing.connection.api_key = secret;
    await secretApp.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: failing });
    const succeeding = payload('secret-success');
    succeeding.connection.api_key = secret;
    await secretApp.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: succeeding });
    const rows = await knex('publish_ledger').whereIn('idempotency_key', ['secret-fail', 'secret-success']);
    expect(JSON.stringify(rows)).not.toContain(secret);
    expect(output).not.toContain(secret);
  } finally { await secretApp.close(); stream.end(); }
});

test('returns 501 for unimplemented methods and blocks disabled destinations', async () => {
  const notImplemented = await app.inject({ method: 'POST', url: '/connector/v1/discourse/fetch_metrics', payload: { idempotency_key: 'not-implemented-1' } });
  expect(notImplemented.statusCode).toBe(501);
  const disabled = payload('disabled-1');
  disabled.destination = { enabled: false, config: { base_url: baseUrl } };
  const disabledResult = await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: disabled });
  expect(disabledResult.statusCode).toBe(409);
  expect(disabledResult.json().error.code).toBe('DESTINATION_DISABLED');
  const unknown = await app.inject({ method: 'POST', url: '/connector/v1/unknown/publish', payload: {} });
  expect(unknown.statusCode).toBe(404);
  const disabledApp = buildApp({ knex, apiToken: '', config: { ...require('../../src/config'), CONNECTORS_DISABLED: ['discourse'] } });
  try {
    const disabledConnector = await disabledApp.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: payload('disabled-connector') });
    expect(disabledConnector.statusCode).toBe(409);
    expect(disabledConnector.json().error.code).toBe('CONNECTOR_DISABLED');
  } finally { await disabledApp.close(); }
});

test('opens the unavailable circuit after the configured failure threshold', async () => {
  const circuitApp = buildApp({ knex, apiToken: '', config: { ...require('../../src/config'), CIRCUIT_FAILURE_THRESHOLD: 2 } });
  const unavailableBase = baseUrl.replace('/normal', '/unavailable');
  const post = (key) => circuitApp.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: { ...payload(key), destination_ref: unavailableBase } });
  try {
    expect((await post('circuit-1')).statusCode).toBe(503);
    expect((await post('circuit-2')).statusCode).toBe(503);
    expect((await post('circuit-3')).statusCode).toBe(503);
    expect((await fetch(`${unavailableBase}/_state`).then((r) => r.json())).post_attempts).toBe(2);
  } finally { await circuitApp.close(); }
});
