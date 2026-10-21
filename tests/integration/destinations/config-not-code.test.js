/**
 * Shows multiple platform instances are catalogue rows rather than code changes.
 * Both forum records share a connector key while using different public base URLs.
 */
const { createDestinationContext, destinationInput, postDestination, clearDestinations } = require('../destinationTestHelpers');
let context;
beforeAll(async () => { context = await createDestinationContext(); });
afterAll(async () => { await context.app.close(); await context.knex.destroy(); });
beforeEach(async () => clearDestinations(context.knex));
test('creates two Discourse instances by API with different configs', async () => {
  const first = await postDestination(context.app, destinationInput({ name: 'Forum A', url: 'https://forum-a.example.com', config: { base_url: 'https://forum-a.example.com' } }));
  const second = await postDestination(context.app, destinationInput({ name: 'Forum B', url: 'https://forum-b.example.com', config: { base_url: 'https://forum-b.example.com' } }));
  expect(first.statusCode).toBe(201);
  expect(second.statusCode).toBe(201);
  const listed = await context.app.inject('/api/v1/destinations?connector_key=discourse');
  expect(listed.json().items).toHaveLength(2);
});
