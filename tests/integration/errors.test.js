/**
 * Confirms common HTTP failures use the shared public error envelope.
 * Injection exercises Fastify parsing, validation, and not-found handling.
 */
process.env.DATABASE_URL = 'postgres://ix:ix@localhost:5432/ix';
jest.mock('cookie', () => ({ stringifySetCookie: ({ name, value }) => `${name}=${value}` }));
const buildApp = require('../../src/app');
const { createTestDatabase } = require('./testDatabase');
let app;
beforeAll(async () => { app = buildApp({ knex: createTestDatabase() }); await app.ready(); });
afterAll(async () => { await app.close(); await app.knex.destroy(); });
function expectEnvelope(response, code) {
  expect(response.statusCode).toBe(code === 'NOT_FOUND' ? 404 : 400);
  expect(response.json()).toEqual(expect.objectContaining({ error: expect.objectContaining({ code, message: expect.any(String), retryable: expect.any(Boolean), details: expect.any(Object) }) }));
  expect(Object.keys(response.json().error).sort()).toEqual(['code', 'details', 'message', 'retryable']);
}
test('unknown route returns the exact not-found envelope', async () => expectEnvelope(await app.inject('/does-not-exist'), 'NOT_FOUND'));
test('malformed JSON returns a validation envelope', async () => expectEnvelope(await app.inject({ method: 'POST', url: '/health', headers: { 'content-type': 'application/json' }, payload: '{broken' }), 'VALIDATION_ERROR'));
test('invalid query returns a validation envelope', async () => expectEnvelope(await app.inject('/health?probe=not-a-number'), 'VALIDATION_ERROR'));
