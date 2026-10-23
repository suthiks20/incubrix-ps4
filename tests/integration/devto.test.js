/**
 * Exercises the Dev.to connector only against its local simulation endpoints.
 * It covers recovery, platform errors, certification, and redaction contracts.
 */
const { PassThrough } = require('stream');
const pino = require('pino');
const buildApp = require('../../src/app');
const { createTestDatabase } = require('./testDatabase');
const loggerOptions = require('../../src/shared/logger');
const { createContext, reset, createDestination, certify } = require('./certification/helpers');

const scenarios = [
  'normal',
  'timeout_after_success',
  'renamed_field',
  'rate_limit_short',
  'rate_limit_long',
  'expired_token',
  'content_rejected',
  'unavailable',
  'delete_fails_once',
  'delete_fails_twice'
];
let app;
let knex;
let baseUrl;

function payload(key, options = {}) {
  const scenario = options.scenario || 'normal';
  return {
    idempotency_key: key,
    destination_ref: options.destination || baseUrl.replace('/normal', `/${scenario}`),
    connection: options.connection || { api_key: 'devto-fake-key' },
    rendition: {
      title: options.title || 'A useful Devto article',
      body: options.body || 'A useful article body.',
      ...(options.canonical_url ? { canonical_url: options.canonical_url } : {})
    }
  };
}

function expectError(response, statusCode, code) {
  expect(response.statusCode).toBe(statusCode);
  expect(response.json()).toEqual({
    error: expect.objectContaining({
      code,
      message: expect.any(String),
      retryable: expect.any(Boolean),
      details: expect.any(Object)
    })
  });
  return response.json().error;
}

async function state(url) {
  return fetch(`${url}/_state`).then((response) => response.json());
}

beforeAll(async () => {
  knex = createTestDatabase();
  app = buildApp({ knex, apiToken: '' });
  await app.listen({ port: 0, host: '127.0.0.1' });
  baseUrl = `http://127.0.0.1:${app.server.address().port}/mock/devto/normal`;
});

beforeEach(async () => {
  await knex.raw('TRUNCATE publish_ledger, destinations, certification_runs, destination_alerts CASCADE');
  await Promise.all(scenarios.map((name) => fetch(`${baseUrl.replace('/normal', `/${name}`)}/_reset`, {
    method: 'POST'
  })));
});

afterAll(async () => {
  await app.close();
  await knex.destroy();
});

test('HARD CASE devto timeout then retry creates exactly one post', async () => {
  const request = payload('devto-timeout-1', { scenario: 'timeout_after_success' });
  expectError(await app.inject({ method: 'POST', url: '/connector/v1/devto/publish', payload: request }), 503, 'PLATFORM_UNAVAILABLE');
  expect((await state(request.destination_ref)).articles).toHaveLength(1);
  const retry = await app.inject({ method: 'POST', url: '/connector/v1/devto/publish', payload: request });
  expect(retry.statusCode).toBe(200);
  expect(retry.headers['idempotent-replay']).toBe('true');
  expect((await state(request.destination_ref)).post_attempts).toBe(1);
});

test('HARD CASE devto renamed field returns SCHEMA_DRIFT', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/connector/v1/devto/publish',
    payload: payload('devto-renamed-1', { scenario: 'renamed_field' })
  });
  expect(expectError(response, 502, 'SCHEMA_DRIFT').details.missing_fields).toContain('url');
});

test('devto 429 long returns PLATFORM_RATE_LIMIT with Retry-After', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/connector/v1/devto/publish',
    payload: payload('devto-rate-long-1', { scenario: 'rate_limit_long' })
  });
  expect(expectError(response, 429, 'PLATFORM_RATE_LIMIT').details.retry_after_seconds).toBe(120);
  expect(response.headers['retry-after']).toBe('120');
});

test('devto 429 short is honoured and publish succeeds', async () => {
  const request = payload('devto-rate-short-1', { scenario: 'rate_limit_short' });
  const response = await app.inject({ method: 'POST', url: '/connector/v1/devto/publish', payload: request });
  expect(response.statusCode).toBe(200);
  expect((await state(request.destination_ref)).post_attempts).toBe(2);
});

test('devto expired token returns CONNECTION_AUTH_EXPIRED', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/connector/v1/devto/publish',
    payload: payload('devto-expired-1', { scenario: 'expired_token' })
  });
  expectError(response, 401, 'CONNECTION_AUTH_EXPIRED');
});

test('devto content rejected returns PLATFORM_CONTENT_REJECTED', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/connector/v1/devto/publish',
    payload: payload('devto-rejected-1', { scenario: 'content_rejected' })
  });
  expectError(response, 422, 'PLATFORM_CONTENT_REJECTED');
});

test('devto title too long returns DEST_SPEC_VIOLATION without a platform call', async () => {
  const request = payload('devto-long-1', { title: 'D'.repeat(129) });
  const response = await app.inject({ method: 'POST', url: '/connector/v1/devto/publish', payload: request });
  expectError(response, 400, 'DEST_SPEC_VIOLATION');
  expect((await state(request.destination_ref)).post_attempts).toBe(0);
});

test('devto certifies as L3 with six passed steps', async () => {
  const ctx = await createContext();
  try {
    await reset(ctx);
    const destination = await createDestination(ctx, 'devto', 'normal');
    const response = await certify(ctx, destination.id, 'devto-certify-1');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'passed', level_awarded: 'L3' });
    expect(response.json().steps).toHaveLength(6);
    expect(response.json().steps.every((step) => step.status === 'passed')).toBe(true);
  } finally {
    await ctx.close();
  }
});

test('devto delete is an unpublish and get_status reports deleted afterwards', async () => {
  const request = payload('devto-delete-1');
  const published = await app.inject({ method: 'POST', url: '/connector/v1/devto/publish', payload: request });
  const id = published.json().platform_post_id;
  const shared = { destination_ref: request.destination_ref, connection: request.connection, platform_post_id: id };
  const deleted = await app.inject({ method: 'POST', url: '/connector/v1/devto/delete', payload: shared });
  expect(deleted.json()).toEqual({ deleted: true });
  const current = await app.inject({ method: 'POST', url: '/connector/v1/devto/get_status', payload: shared });
  expect(current.json()).toEqual({ status: 'deleted', live_url: null });
});

test('devto delete_fails_once exposes the first cleanup failure then succeeds', async () => {
  const request = payload('devto-delete-once-1', { scenario: 'delete_fails_once' });
  const published = await app.inject({ method: 'POST', url: '/connector/v1/devto/publish', payload: request });
  const shared = { destination_ref: request.destination_ref, connection: request.connection, platform_post_id: published.json().platform_post_id };
  expectError(await app.inject({ method: 'POST', url: '/connector/v1/devto/delete', payload: shared }), 503, 'PLATFORM_UNAVAILABLE');
  expect((await app.inject({ method: 'POST', url: '/connector/v1/devto/delete', payload: shared })).json()).toEqual({ deleted: true });
});

test('devto delete_fails_twice records two explicit cleanup failures', async () => {
  const request = payload('devto-delete-twice-1', { scenario: 'delete_fails_twice' });
  const published = await app.inject({ method: 'POST', url: '/connector/v1/devto/publish', payload: request });
  const shared = { destination_ref: request.destination_ref, connection: request.connection, platform_post_id: published.json().platform_post_id };
  expectError(await app.inject({ method: 'POST', url: '/connector/v1/devto/delete', payload: shared }), 503, 'PLATFORM_UNAVAILABLE');
  expectError(await app.inject({ method: 'POST', url: '/connector/v1/devto/delete', payload: shared }), 503, 'PLATFORM_UNAVAILABLE');
  expect((await state(request.destination_ref)).delete_attempts).toBe(2);
});

test('devto unavailable returns PLATFORM_UNAVAILABLE', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/connector/v1/devto/publish',
    payload: payload('devto-unavailable-1', { scenario: 'unavailable' })
  });
  expectError(response, 503, 'PLATFORM_UNAVAILABLE');
});

test('devto secrets never appear in logs responses or ledger', async () => {
  let logs = '';
  const stream = new PassThrough();
  stream.on('data', (chunk) => { logs += chunk.toString(); });
  const secret = 'devto-fake-secret-not-for-production';
  const secretApp = buildApp({ knex, apiToken: '', logger: pino({ ...loggerOptions }, stream) });
  try {
    const request = payload('devto-secret-1', { scenario: 'expired_token', connection: { api_key: secret } });
    const response = await secretApp.inject({ method: 'POST', url: '/connector/v1/devto/publish', payload: request });
    expectError(response, 401, 'CONNECTION_AUTH_EXPIRED');
    const rows = await knex('publish_ledger').where({ idempotency_key: request.idempotency_key });
    expect(JSON.stringify(response.json())).not.toContain(secret);
    expect(JSON.stringify(rows)).not.toContain(secret);
    expect(logs).not.toContain(secret);
  } finally {
    await secretApp.close();
    stream.end();
  }
});
