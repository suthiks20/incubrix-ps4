/**
 * Exercises shared idempotency hooks with focused test-only routes and real PostgreSQL.
 * Keeping these routes standalone avoids changing the production API surface.
 */
const Fastify = require('fastify');
const { setTimeout } = require('timers');
const config = require('../../../src/config');
const { createTestDatabase } = require('../testDatabase');
const idempotency = require('../../../src/shared/plugins/idempotency');
const registerErrorHandlers = require('../../../src/shared/errors/errorHandler');
let app;
let knex;
let runCount;

async function makeApp() {
  knex = createTestDatabase();
  app = Fastify({ logger: false });
  app.decorate('knex', knex);
  idempotency(app, config);
  registerErrorHandlers(app);
  runCount = 0;
  app.post('/api/v1/fails', async () => { runCount += 1; throw new Error('expected test failure'); });
  app.post('/api/v1/slow', async () => { runCount += 1; await new Promise((resolve) => setTimeout(resolve, 300)); return { run: runCount }; });
  app.post('/api/v1/first-path', async () => ({ path: 'first' }));
  app.post('/api/v1/second-path', async () => ({ path: 'second' }));
  app.post('/connector/v1/test', async () => ({ connector: true }));
  await app.ready();
}

beforeAll(makeApp);
afterAll(async () => { await app.close(); await knex.destroy(); });
beforeEach(async () => { runCount = 0; await knex('idempotency_keys').truncate(); });

test('a 500 releases the key so a retry runs the handler again', async () => {
  for (let index = 0; index < 2; index += 1) {
    const response = await app.inject({ method: 'POST', url: '/api/v1/fails', headers: { 'Idempotency-Key': 'retry-after-500' } });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', retryable: false, details: {} } });
  }
  expect(runCount).toBe(2);
  expect(await knex('idempotency_keys').where({ key: 'retry-after-500' })).toHaveLength(0);
});

test('concurrent slow requests run once and return the same result', async () => {
  const request = { method: 'POST', url: '/api/v1/slow', headers: { 'Idempotency-Key': 'slow-once' } };
  const responses = await Promise.all([app.inject(request), app.inject(request)]);
  expect(runCount).toBe(1);
  expect(responses[0].json()).toEqual(responses[1].json());
  expect(responses.filter((response) => response.headers['idempotent-replay'] === 'true')).toHaveLength(1);
});

test('the same key on another path owns an independent record', async () => {
  const headers = { 'Idempotency-Key': 'path-scoped' };
  expect((await app.inject({ method: 'POST', url: '/api/v1/first-path', headers })).json()).toEqual({ path: 'first' });
  const second = await app.inject({ method: 'POST', url: '/api/v1/second-path', headers });
  expect(second.statusCode).toBe(200);
  expect(second.json()).toEqual({ path: 'second' });
  expect(second.headers['idempotent-replay']).toBeUndefined();
});

test('connector POST routes are excluded from the header requirement', async () => {
  const response = await app.inject({ method: 'POST', url: '/connector/v1/test', payload: { idempotency_key: 'body-key' } });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ connector: true });
});

test('an old in-progress row is reclaimed', async () => {
  const oldDate = new Date(Date.now() - (config.IDEMPOTENCY_LOCK_TTL_SECONDS + 10) * 1000);
  await knex('idempotency_keys').insert({
    key: 'stale-lock', method: 'POST', path: '/api/v1/first-path', request_hash: require('../../../src/shared/idempotency/hash').requestHash('POST', '/api/v1/first-path', '', null),
    state: 'in_progress', created_at: oldDate, updated_at: oldDate, expires_at: new Date(Date.now() + 60000)
  });
  const response = await app.inject({ method: 'POST', url: '/api/v1/first-path', headers: { 'Idempotency-Key': 'stale-lock' } });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ path: 'first' });
  expect((await knex('idempotency_keys').where({ key: 'stale-lock' }).first()).state).toBe('completed');
});
