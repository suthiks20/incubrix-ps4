/**
 * Checks schema validation for missing, unknown, and out-of-range input values.
 * Every failure must use the standard VALIDATION_ERROR envelope.
 */
const { createDestinationContext, destinationInput, clearDestinations, expectEnvelope } = require('../destinationTestHelpers');
let context;
beforeAll(async () => { context = await createDestinationContext(); });
afterAll(async () => { await context.app.close(); await context.knex.destroy(); });
beforeEach(async () => clearDestinations(context.knex));
test('rejects invalid create, update, path, and list inputs', async () => {
  const base = destinationInput();
  const missing = { ...base }; delete missing.name;
  expectEnvelope(await context.app.inject({ method: 'POST', url: '/api/v1/destinations', payload: missing }), 'VALIDATION_ERROR', 400);
  expectEnvelope(await context.app.inject({ method: 'POST', url: '/api/v1/destinations', payload: { ...base, surprise: true } }), 'VALIDATION_ERROR', 400);
  expectEnvelope(await context.app.inject('/api/v1/destinations/not-a-uuid'), 'VALIDATION_ERROR', 400);
  for (const changes of [{ level: 'L5' }, { link_policy: 'sometimes' }, { relevance_score: 6 }]) {
    const created = (await context.app.inject({ method: 'POST', url: '/api/v1/destinations', payload: base })).json();
    expectEnvelope(await context.app.inject({ method: 'PUT', url: `/api/v1/destinations/${created.id}`, payload: changes }), 'VALIDATION_ERROR', 400);
    await clearDestinations(context.knex);
  }
  expectEnvelope(await context.app.inject('/api/v1/destinations?limit=500'), 'VALIDATION_ERROR', 400);
});
