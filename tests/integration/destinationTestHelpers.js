/**
 * Provides shared app, database, and fixture helpers for destination integration tests.
 * Every database client points at TEST_DATABASE_URL through testDatabase.js.
 */
const buildApp = require('../../src/app');
const { createTestDatabase } = require('./testDatabase');

async function createDestinationContext(apiToken = '') {
  const knex = createTestDatabase();
  const app = buildApp({ knex, apiToken });
  await app.ready();
  return { app, knex };
}
function destinationInput(overrides = {}) {
  return { name: 'Example Community', url: 'https://forum.example.com/', platform_key: 'discourse', connector_key: 'discourse', config: { base_url: 'https://forum.example.com' }, ...overrides };
}
async function clearDestinations(knex) { await knex('destinations').truncate(); }
function expectEnvelope(response, code, statusCode) {
  expect(response.statusCode).toBe(statusCode);
  expect(response.json()).toEqual({ error: expect.objectContaining({ code, message: expect.any(String), retryable: expect.any(Boolean), details: expect.any(Object) }) });
  expect(Object.keys(response.json().error).sort()).toEqual(['code', 'details', 'message', 'retryable']);
}

module.exports = { createDestinationContext, destinationInput, clearDestinations, expectEnvelope };
