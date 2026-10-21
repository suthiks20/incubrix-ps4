/**
 * Confirms readiness reports a clear database-down error for an unreachable server.
 * A short connection timeout keeps the failure test quick and self-contained.
 */
const knexFactory = require('knex');
const buildApp = require('../../src/app');
let app;
let knex;
beforeAll(async () => {
  knex = knexFactory({ client: 'pg', connection: { host: '127.0.0.1', port: 1, user: 'ix', password: 'ix', database: 'unreachable', connectionTimeoutMillis: 200 }, pool: { min: 0, max: 1, acquireTimeoutMillis: 500 }, log: { warn: () => {} } });
  app = buildApp({ knex, apiToken: '' });
  await app.ready();
});
afterAll(async () => { await app.close(); await knex.destroy(); });
test('returns NOT_READY when the database cannot be reached', async () => {
  const response = await app.inject('/ready');
  expect(response.statusCode).toBe(503);
  expect(response.json()).toEqual({ error: { code: 'NOT_READY', message: 'Service is not ready', retryable: false, details: { checks: { db: 'down' } } } });
});
