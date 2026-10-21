/**
 * Exercises destination create, read, partial update, list, and hard delete over HTTP.
 * The app uses the isolated TEST_DATABASE_URL database initialized by Jest global setup.
 */
const { createDestinationContext, destinationInput, postDestination, clearDestinations, expectEnvelope } = require('../destinationTestHelpers');
let context;
beforeAll(async () => { context = await createDestinationContext(); });
afterAll(async () => { await context.app.close(); await context.knex.destroy(); });
beforeEach(async () => clearDestinations(context.knex));
test('creates, gets, updates, lists, deletes, then reports not found', async () => {
  const createdResponse = await postDestination(context.app, destinationInput());
  expect(createdResponse.statusCode).toBe(201);
  const created = createdResponse.json();
  expect(created.url_normalized).toBe('https://forum.example.com/');
  expect((await context.app.inject(`/api/v1/destinations/${created.id}`)).statusCode).toBe(200);
  const updated = await context.app.inject({ method: 'PUT', url: `/api/v1/destinations/${created.id}`, payload: { name: 'Updated forum' } });
  expect(updated.statusCode).toBe(200);
  expect(updated.json().name).toBe('Updated forum');
  const listed = await context.app.inject('/api/v1/destinations');
  expect(listed.json()).toMatchObject({ total: 1, items: [{ name: 'Updated forum' }] });
  expect((await context.app.inject({ method: 'DELETE', url: `/api/v1/destinations/${created.id}` })).json()).toEqual({ deleted: true });
  expectEnvelope(await context.app.inject(`/api/v1/destinations/${created.id}`), 'NOT_FOUND', 404);
});
