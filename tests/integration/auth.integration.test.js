/**
 * Verifies bearer-token enforcement on protected API paths and public health routes.
 * The token is injected as an app option so tests never mutate process.env.
 */
const { createDestinationContext, expectEnvelope } = require('./destinationTestHelpers');
let context;
beforeAll(async () => { context = await createDestinationContext('phase-two-test-token'); });
afterAll(async () => { await context.app.close(); await context.knex.destroy(); });
test('protects destinations while leaving health routes public', async () => {
  expectEnvelope(await context.app.inject('/api/v1/destinations'), 'UNAUTHORIZED', 401);
  expectEnvelope(await context.app.inject({ method: 'GET', url: '/api/v1/destinations', headers: { authorization: 'Bearer wrong' } }), 'UNAUTHORIZED', 401);
  expect((await context.app.inject({ method: 'GET', url: '/api/v1/destinations', headers: { authorization: 'Bearer phase-two-test-token' } })).statusCode).toBe(200);
  expect((await context.app.inject('/health')).statusCode).toBe(200);
  expect((await context.app.inject('/api/v1/health')).statusCode).toBe(200);
});
