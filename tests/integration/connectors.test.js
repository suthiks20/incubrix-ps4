/**
 * Covers the Discourse connector's publish, recovery, and failure contract.
 * Each hard case runs against the test database and local mock platform.
 */
const buildApp = require('../../src/app');
const { createTestDatabase } = require('./testDatabase');
const pino = require('pino');
const { PassThrough } = require('stream');
const loggerOptions = require('../../src/shared/logger');

const scenarioNames = ['normal', 'timeout_after_success', 'unavailable', 'rate_limit', 'rate_limit_long', 'expired_token', 'revoked', 'content_rejected', 'renamed_field'];
let app;
let knex;
let baseUrl;
beforeAll(async () => {
  knex = createTestDatabase();
  app = buildApp({ knex, apiToken: '' });
  await app.listen({ port: 0, host: '127.0.0.1' });
  baseUrl = `http://127.0.0.1:${app.server.address().port}/mock/discourse/normal`;
});
beforeEach(async () => {
  await knex('publish_ledger').del();
  await Promise.all(scenarioNames.map((name) => fetch(`${baseUrl.replace('/normal', `/${name}`)}/_reset`, { method: 'POST' })));
});
afterAll(async () => { await app.close(); await knex.destroy(); });

function payload(key, { scenario = 'normal', title = 'A sufficiently long title', body = 'Hello forum', destination, connection } = {}) {
  return {
    idempotency_key: key,
    destination_ref: destination || baseUrl.replace('/normal', `/${scenario}`),
    connection: connection || { api_key: 'unit-secret-key', api_username: 'tester' },
    rendition: { title, body }
  };
}

function expectErrorEnvelope(response, status, code) {
  expect(response.statusCode).toBe(status);
  const envelope = response.json();
  expect(Object.keys(envelope)).toEqual(['error']);
  expect(Object.keys(envelope.error).sort()).toEqual(['code', 'details', 'message', 'retryable']);
  expect(envelope.error).toEqual({
    code,
    message: expect.any(String),
    retryable: expect.any(Boolean),
    details: expect.any(Object)
  });
  return envelope.error;
}

async function mockState(destination) {
  return fetch(`${destination}/_state`).then((response) => response.json());
}

test('HARD CASE timeout then retry creates exactly one post', async () => {
  const request = payload('hard-timeout-1', { scenario: 'timeout_after_success' });
  const first = await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: request });
  const failure = expectErrorEnvelope(first, 503, 'PLATFORM_UNAVAILABLE');
  expect(failure.message).toMatch(/timed out|connection dropped/i);
  expect(failure.details).toEqual({
    ledger_state: 'unknown',
    action: 'Retry with the same idempotency_key. The service will check the platform for the post before publishing again, so no duplicate is created.'
  });
  const ledgerAfterFailure = await knex('publish_ledger').where({ idempotency_key: request.idempotency_key }).first();
  expect(ledgerAfterFailure.state).toBe('unknown');
  const stateAfterFailure = await mockState(request.destination_ref);
  expect(stateAfterFailure.posts).toHaveLength(1);
  expect(stateAfterFailure.post_attempts).toBe(1);

  const retry = await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: request });
  expect(retry.statusCode).toBe(200);
  expect(retry.headers['idempotent-replay']).toBe('true');
  expect(retry.json().platform_post_id).toBe(String(stateAfterFailure.posts[0].topic_id));
  expect(Object.prototype.hasOwnProperty.call(retry.json(), 'replay')).toBe(false);
  const stateAfterRetry = await mockState(request.destination_ref);
  expect(stateAfterRetry.posts).toHaveLength(1);
  expect(stateAfterRetry.post_attempts).toBe(1);
  const ledgerAfterRetry = await knex('publish_ledger').where({ idempotency_key: request.idempotency_key }).first();
  expect(ledgerAfterRetry.state).toBe('published');
});

test('HARD CASE same key and different body returns IDEMPOTENCY_KEY_CONFLICT', async () => {
  const first = payload('hard-conflict-1');
  await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: first });
  const changed = { ...first, rendition: { ...first.rendition, body: 'Changed body' } };
  const error = expectErrorEnvelope(await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: changed }), 409, 'IDEMPOTENCY_KEY_CONFLICT');
  expect(error.message).toMatch(/different request/i);
});

test('HARD CASE missing idempotency key returns IDEMPOTENCY_KEY_REQUIRED', async () => {
  const request = payload('unused');
  delete request.idempotency_key;
  const error = expectErrorEnvelope(await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: request }), 400, 'IDEMPOTENCY_KEY_REQUIRED');
  expect(error.message).toMatch(/Idempotency-Key/i);
  expect(await knex('publish_ledger').count('* as total').first().then((row) => Number(row.total))).toBe(0);
});

test('HARD CASE short 429 is honoured and publish succeeds', async () => {
  const request = payload('hard-rate-short', { scenario: 'rate_limit' });
  const response = await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: request });
  expect(response.statusCode).toBe(200);
  expect((await mockState(request.destination_ref)).post_attempts).toBe(2);
});

test('HARD CASE long 429 returns PLATFORM_RATE_LIMIT with Retry-After header', async () => {
  const request = payload('hard-rate-long', { scenario: 'rate_limit_long' });
  const response = await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: request });
  const error = expectErrorEnvelope(response, 429, 'PLATFORM_RATE_LIMIT');
  expect(response.headers['retry-after']).toBe('120');
  expect(error.retryable).toBe(true);
  expect(error.details.retry_after_seconds).toBe(120);
  expect(error.details.action).toEqual(expect.any(String));
});

test('HARD CASE expired token returns CONNECTION_AUTH_EXPIRED', async () => {
  const error = expectErrorEnvelope(await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: payload('hard-expired', { scenario: 'expired_token' }) }), 401, 'CONNECTION_AUTH_EXPIRED');
  expect(error.message).toMatch(/HTTP 401/);
});

test('HARD CASE revoked permission returns CONNECTION_AUTH_EXPIRED', async () => {
  const error = expectErrorEnvelope(await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: payload('hard-revoked', { scenario: 'revoked' }) }), 401, 'CONNECTION_AUTH_EXPIRED');
  expect(error.details.platform_status).toBe(403);
});

test('HARD CASE content rejected returns PLATFORM_CONTENT_REJECTED with the platform message in details', async () => {
  const error = expectErrorEnvelope(await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: payload('hard-rejected', { scenario: 'content_rejected' }) }), 422, 'PLATFORM_CONTENT_REJECTED');
  expect(error.details.platform_message).toBe('Title is too short');
});

test('HARD CASE renamed field returns SCHEMA_DRIFT naming topic_id', async () => {
  const error = expectErrorEnvelope(await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: payload('hard-renamed', { scenario: 'renamed_field' }) }), 502, 'SCHEMA_DRIFT');
  expect(error.details.missing_fields).toContain('topic_id');
});

test('HARD CASE title too long returns DEST_SPEC_VIOLATION and makes no platform request', async () => {
  const request = payload('hard-long-title', { title: 'T'.repeat(256) });
  const error = expectErrorEnvelope(await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: request }), 400, 'DEST_SPEC_VIOLATION');
  expect(error.details.violations).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'title' })]));
  expect((await mockState(request.destination_ref)).post_attempts).toBe(0);
});

test('HARD CASE body too long returns DEST_SPEC_VIOLATION', async () => {
  const error = expectErrorEnvelope(await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: payload('hard-long-body', { body: 'B'.repeat(32001) }) }), 400, 'DEST_SPEC_VIOLATION');
  expect(error.details.violations).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'body' })]));
});

test('HARD CASE circuit opens after 5 failures and stops calling the platform', async () => {
  const unavailableUrl = baseUrl.replace('/normal', '/unavailable');
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const error = expectErrorEnvelope(await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: payload(`hard-circuit-${attempt}`, { destination: unavailableUrl }) }), 503, 'PLATFORM_UNAVAILABLE');
    expect(error.details.ledger_state).toBe('unknown');
  }
  expect((await mockState(unavailableUrl)).post_attempts).toBe(5);
  const sixth = expectErrorEnvelope(await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: payload('hard-circuit-6', { destination: unavailableUrl }) }), 503, 'PLATFORM_UNAVAILABLE');
  expect(sixth.details.circuit_open).toBe(true);
  expect((await mockState(unavailableUrl)).post_attempts).toBe(5);
});

test('kill switch returns CONNECTOR_DISABLED', async () => {
  const disabledApp = buildApp({ knex, apiToken: '', config: { ...require('../../src/config'), CONNECTORS_DISABLED: ['discourse'] } });
  try {
    expectErrorEnvelope(await disabledApp.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: payload('hard-kill-switch') }), 409, 'CONNECTOR_DISABLED');
  } finally { await disabledApp.close(); }
});

test('disabled destination returns DESTINATION_DISABLED', async () => {
  const request = payload('hard-destination-disabled');
  request.destination = { enabled: false, config: { base_url: request.destination_ref } };
  expectErrorEnvelope(await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: request }), 409, 'DESTINATION_DISABLED');
});

test('unknown connector returns NOT_FOUND', async () => {
  expectErrorEnvelope(await app.inject({ method: 'POST', url: '/connector/v1/missing/publish', payload: {} }), 404, 'NOT_FOUND');
});

test('fetch_metrics returns CONNECTOR_NOT_IMPLEMENTED', async () => {
  expectErrorEnvelope(await app.inject({ method: 'POST', url: '/connector/v1/discourse/fetch_metrics', payload: { idempotency_key: 'hard-metrics' } }), 501, 'CONNECTOR_NOT_IMPLEMENTED');
});

test('secrets never appear in logs, responses or ledger', async () => {
  let logs = '';
  const stream = new PassThrough();
  stream.on('data', (chunk) => { logs += chunk.toString(); });
  const secretApp = buildApp({ knex, apiToken: '', logger: pino({ ...loggerOptions, level: 'info' }, stream) });
  const secret = 'connector-secret-very-unique';
  try {
    const failing = payload('hard-secret-fail', { scenario: 'expired_token', connection: { api_key: secret, api_username: 'private-user' } });
    const failure = await secretApp.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: failing });
    expectErrorEnvelope(failure, 401, 'CONNECTION_AUTH_EXPIRED');
    const succeeding = payload('hard-secret-success', { connection: { api_key: secret, api_username: 'private-user' } });
    const success = await secretApp.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: succeeding });
    expect(success.statusCode).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const ledgerRows = await knex('publish_ledger').whereIn('idempotency_key', ['hard-secret-fail', 'hard-secret-success']);
    expect(JSON.stringify(failure.json())).not.toContain(secret);
    expect(JSON.stringify(success.json())).not.toContain(secret);
    expect(JSON.stringify(ledgerRows)).not.toContain(secret);
    expect(logs).not.toContain(secret);
    expect(logs).not.toContain('private-user');
  } finally { await secretApp.close(); stream.end(); }
});

test('publish get_status delete round trip', async () => {
  const request = payload('hard-round-trip');
  const published = await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: request });
  expect(published.statusCode).toBe(200);
  expect(Object.prototype.hasOwnProperty.call(published.json(), 'replay')).toBe(false);
  const postId = published.json().platform_post_id;
  const statusPayload = { idempotency_key: 'hard-status', destination_ref: request.destination_ref, connection: request.connection, platform_post_id: postId };
  const current = await app.inject({ method: 'POST', url: '/connector/v1/discourse/get_status', payload: statusPayload });
  expect(current.json()).toMatchObject({ status: 'published', live_url: published.json().live_url });
  const deletePayload = { ...statusPayload, idempotency_key: 'hard-delete' };
  expect((await app.inject({ method: 'POST', url: '/connector/v1/discourse/delete', payload: deletePayload })).json()).toEqual({ deleted: true });
  expect((await app.inject({ method: 'POST', url: '/connector/v1/discourse/delete', payload: { ...deletePayload, idempotency_key: 'hard-delete-again' } })).json()).toEqual({ deleted: true });
  const afterDelete = await app.inject({ method: 'POST', url: '/connector/v1/discourse/get_status', payload: { ...statusPayload, idempotency_key: 'hard-status-after-delete' } });
  expect(afterDelete.json()).toEqual({ status: 'deleted', live_url: null });
});
