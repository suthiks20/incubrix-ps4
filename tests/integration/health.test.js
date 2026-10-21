/**
 * Uses Fastify injection and the dedicated Jest database for readiness checks.
 * The database setup never connects to the development database.
 */
process.env.DATABASE_URL = 'postgres://ix:ix@localhost:5432/ix';
jest.mock('cookie', () => ({ stringifySetCookie: ({ name, value }) => `${name}=${value}` }));
const buildApp = require('../../src/app');
const { createTestDatabase } = require('./testDatabase');
let app;
beforeAll(async () => { app = buildApp({ knex: createTestDatabase() }); await app.ready(); });
afterAll(async () => { await app.close(); await app.knex.destroy(); });
test('health and readiness aliases return success contracts', async () => {
  for (const url of ['/health', '/ready', '/api/v1/health', '/api/v1/ready']) expect((await app.inject({ method: 'GET', url })).statusCode).toBe(200);
  expect((await app.inject('/health')).json().status).toBe('ok');
  expect((await app.inject('/ready')).json()).toEqual({ status: 'ready', checks: { db: 'ok' } });
});
test('returns and echoes a correlation ID', async () => {
  expect((await app.inject('/health')).headers['x-correlation-id']).toBeTruthy();
  expect((await app.inject({ method: 'GET', url: '/health', headers: { 'x-correlation-id': 'student-trace-id' } })).headers['x-correlation-id']).toBe('student-trace-id');
});
