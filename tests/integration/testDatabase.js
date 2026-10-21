/**
 * Creates Knex clients for the isolated Jest database configured for tests.
 * This helper deliberately never uses the development DATABASE_URL setting.
 */
const knex = require('knex');
const config = require('../../src/config');

function createTestDatabase() {
  if (!config.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required for database-backed tests');
  return knex({ client: 'pg', connection: config.TEST_DATABASE_URL, pool: { min: 0, max: 3 } });
}

module.exports = { createTestDatabase };
