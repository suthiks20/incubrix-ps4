/**
 * Verifies normalized duplicate detection and the database unique constraint race.
 * Duplicate URLs are scoped by platform key, not connector implementation.
 */
const { createDestinationContext, destinationInput, clearDestinations, expectEnvelope } = require('../destinationTestHelpers');
let context;
beforeAll(async () => { context = await createDestinationContext(); });
afterAll(async () => { await context.app.close(); await context.knex.destroy(); });
beforeEach(async () => clearDestinations(context.knex));
test('catches normalized duplicates but allows another platform', async () => {
  expect((await context.app.inject({ method: 'POST', url: '/api/v1/destinations', payload: destinationInput() })).statusCode).toBe(201);
  expectEnvelope(await context.app.inject({ method: 'POST', url: '/api/v1/destinations', payload: destinationInput({ url: 'HTTPS://FORUM.EXAMPLE.COM/#welcome' }) }), 'DUPLICATE_DESTINATION', 409);
  expect((await context.app.inject({ method: 'POST', url: '/api/v1/destinations', payload: destinationInput({ platform_key: 'lemmy' }) })).statusCode).toBe(201);
});
test('simultaneous identical creates leave one row and one conflict', async () => {
  const attempts = await Promise.all([
    context.app.inject({ method: 'POST', url: '/api/v1/destinations', payload: destinationInput() }),
    context.app.inject({ method: 'POST', url: '/api/v1/destinations', payload: destinationInput() })
  ]);
  expect(attempts.map((response) => response.statusCode).sort()).toEqual([201, 409]);
  expect(Number((await context.knex('destinations').count({ total: '*' }).first()).total)).toBe(1);
});
