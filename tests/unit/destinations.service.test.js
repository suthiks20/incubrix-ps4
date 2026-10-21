/**
 * Tests destination business rules with an in-memory Knex query builder.
 * No test connects to PostgreSQL or depends on external state.
 */
const repository = require('../../src/modules/destinations/repository/destinations');
const { create } = require('../../src/modules/destinations/services/create');
const { getById } = require('../../src/modules/destinations/services/getById');
const { update } = require('../../src/modules/destinations/services/update');
const { remove } = require('../../src/modules/destinations/services/delete');
const { createKnexMock } = require('../../src/modules/destinations/repository/__mocks__/knex.mock');

let knex;
beforeEach(() => { knex = createKnexMock(); });
afterEach(() => jest.restoreAllMocks());
test('creates a destination and stores its normalized URL', async () => {
  const result = await create(knex, { name: 'Forum', url: 'https://FORUM.example.com', platform_key: 'discourse', connector_key: 'discourse' });
  expect(result.url_normalized).toBe('https://forum.example.com/');
});
test('rejects a duplicate destination', async () => {
  const input = { name: 'Forum', url: 'https://forum.example.com', platform_key: 'discourse', connector_key: 'discourse' };
  await create(knex, input);
  await expect(create(knex, input)).rejects.toMatchObject({ code: 'DUPLICATE_DESTINATION', statusCode: 409 });
});
test('maps a unique violation to DUPLICATE_DESTINATION', async () => {
  jest.spyOn(repository, 'insert').mockRejectedValue({ code: '23505' });
  await expect(create(knex, { name: 'Forum', url: 'https://forum.example.com', platform_key: 'discourse', connector_key: 'discourse' })).rejects.toMatchObject({ code: 'DUPLICATE_DESTINATION' });
});
test('reports missing records for get, update, and delete', async () => {
  const missingId = '00000000-0000-4000-8000-000000000099';
  await expect(getById(knex, missingId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(update(knex, missingId, { name: 'Updated' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(remove(knex, missingId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
});
test('rejects config containing a secret key', async () => {
  await expect(create(knex, { name: 'Forum', url: 'https://forum.example.com', platform_key: 'discourse', connector_key: 'discourse', config: { api_key: 'secret' } })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
});
