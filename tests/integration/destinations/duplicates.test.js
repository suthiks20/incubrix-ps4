/**
 * Verifies normalized duplicate detection and the database unique constraint race.
 * Duplicate URLs are scoped by platform key, not connector implementation.
 */
const { createDestinationContext, destinationInput, postDestination, clearDestinations, expectEnvelope } = require('../destinationTestHelpers');
let context;
beforeAll(async () => { context = await createDestinationContext(); });
afterAll(async () => { await context.app.close(); await context.knex.destroy(); });
beforeEach(async () => clearDestinations(context.knex));
test('catches normalized duplicates but allows another platform', async () => {
  expect((await postDestination(context.app, destinationInput())).statusCode).toBe(201);
  expectEnvelope(await postDestination(context.app, destinationInput({ url: 'HTTPS://FORUM.EXAMPLE.COM/#welcome' })), 'DUPLICATE_DESTINATION', 409);
  expect((await postDestination(context.app, destinationInput({ platform_key: 'lemmy' }))).statusCode).toBe(201);
});
test('simultaneous identical creates leave one row and one conflict', async () => {
  const attempts = await Promise.all([
    postDestination(context.app, destinationInput(), { key: 'unique-race-one' }),
    postDestination(context.app, destinationInput(), { key: 'unique-race-two' })
  ]);
  expect(attempts.map((response) => response.statusCode).sort()).toEqual([201, 409]);
  expect(Number((await context.knex('destinations').count({ total: '*' }).first()).total)).toBe(1);
});
