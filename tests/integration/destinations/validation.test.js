/**
 * Checks schema validation for missing, unknown, and out-of-range input values.
 * Every failure must use the standard VALIDATION_ERROR envelope.
 */
const { createDestinationContext, destinationInput, postDestination, clearDestinations, expectEnvelope } = require('../destinationTestHelpers');
let context;
beforeAll(async () => { context = await createDestinationContext(); });
afterAll(async () => { await context.app.close(); await context.knex.destroy(); });
beforeEach(async () => clearDestinations(context.knex));
test('rejects invalid create, update, path, and list inputs', async () => {
  const base = destinationInput();
  const missing = { ...base }; delete missing.name;
  expectEnvelope(await postDestination(context.app, missing), 'VALIDATION_ERROR', 400);
  expectEnvelope(await postDestination(context.app, { ...base, surprise: true }), 'VALIDATION_ERROR', 400);
  expectEnvelope(await context.app.inject('/api/v1/destinations/not-a-uuid'), 'VALIDATION_ERROR', 400);
  for (const changes of [{ link_policy: 'sometimes' }, { relevance_score: 6 }]) {
    const created = (await postDestination(context.app, base)).json();
    expectEnvelope(await context.app.inject({ method: 'PUT', url: `/api/v1/destinations/${created.id}`, payload: changes }), 'VALIDATION_ERROR', 400);
    await clearDestinations(context.knex);
  }
  expectEnvelope(await context.app.inject('/api/v1/destinations?limit=500'), 'VALIDATION_ERROR', 400);
});

test('create and update reject client-supplied server-managed level without changing data', async () => {
  const input = destinationInput({ url: 'https://level.example.com' });
  const created = await postDestination(context.app, input);
  expect(created.statusCode).toBe(201);
  const id = created.json().id;
  const before = await context.knex('destinations').where({ id }).first();

  expectEnvelope(await postDestination(context.app, { ...input, level: 'L3' }), 'VALIDATION_ERROR', 400);
  expect(Number((await context.knex('destinations').count({ total: '*' }).first()).total)).toBe(1);
  expectEnvelope(await context.app.inject({ method: 'PUT', url: `/api/v1/destinations/${id}`, payload: { level: 'L3' } }), 'VALIDATION_ERROR', 400);

  const after = await context.knex('destinations').where({ id }).first();
  expect(after.level).toBe('L0');
  expect(after.updated_at).toEqual(before.updated_at);
  expect(after.name).toBe(before.name);
});
