/**
 * Creates the dedicated Jest database and applies the project migrations.
 * It never connects to DATABASE_URL, which belongs to the development service.
 */
const { Client } = require('pg');
const knexFactory = require('knex');
const config = require('../../src/config');
const knexfile = require('../../knexfile');
const { runMigrations } = require('../../src/db/migrate');

module.exports = async function globalSetup() {
  if (!config.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required for database-backed tests');
  const testUrl = new URL(config.TEST_DATABASE_URL);
  const testDatabase = decodeURIComponent(testUrl.pathname.slice(1));
  if (!testDatabase) throw new Error('TEST_DATABASE_URL must include a database name');
  const maintenanceUrl = new URL(config.TEST_DATABASE_URL);
  maintenanceUrl.pathname = '/postgres';
  const client = new Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();
  try {
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [testDatabase]);
    if (result.rowCount === 0) {
      const safeName = testDatabase.replace(/"/g, '""');
      await client.query(`CREATE DATABASE "${safeName}"`);
    }
  } finally {
    await client.end();
  }
  const testKnexfile = { ...knexfile, connection: config.TEST_DATABASE_URL };
  const testKnex = knexFactory(testKnexfile);
  try {
    await runMigrations(testKnex, { info: () => {} });
  } finally {
    await testKnex.destroy();
  }
};
