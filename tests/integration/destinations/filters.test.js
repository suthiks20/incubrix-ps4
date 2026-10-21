/**
 * Verifies destination filters and offset pagination through the public API.
 * Total counts reflect the filtered set before limit and offset are applied.
 */
const { createDestinationContext, destinationInput, clearDestinations } = require('../destinationTestHelpers');
let context;
beforeAll(async () => { context = await createDestinationContext(); });
afterAll(async () => { await context.app.close(); await context.knex.destroy(); });
beforeEach(async () => clearDestinations(context.knex));
test('filters by platform, level, enabled, and demoted and paginates', async () => {
  for (const input of [
    destinationInput({ name: 'A', url: 'https://a.example.com', platform_key: 'discourse', level: 'L1' }),
    destinationInput({ name: 'B', url: 'https://b.example.com', platform_key: 'lemmy', level: 'L1', enabled: false }),
    destinationInput({ name: 'C', url: 'https://c.example.com', platform_key: 'discourse', level: 'L2', demoted: true })
  ]) expect((await context.app.inject({ method: 'POST', url: '/api/v1/destinations', payload: input })).statusCode).toBe(201);
  expect((await context.app.inject('/api/v1/destinations?platform_key=discourse')).json().total).toBe(2);
  expect((await context.app.inject('/api/v1/destinations?level=L1')).json().total).toBe(2);
  expect((await context.app.inject('/api/v1/destinations?enabled=false')).json().total).toBe(1);
  expect((await context.app.inject('/api/v1/destinations?demoted=true')).json().total).toBe(1);
  expect((await context.app.inject('/api/v1/destinations?limit=1&offset=1')).json()).toMatchObject({ total: 3, limit: 1, offset: 1, items: expect.any(Array) });
});
