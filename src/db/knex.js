/**
 * Creates the shared Knex client from validated application configuration.
 * Repositories receive this client and contain the actual SQL calls.
 */
const knex = require('knex');
const config = require('../config');

module.exports = knex({
  client: 'pg',
  connection: config.DATABASE_URL,
  pool: { min: 0, max: 5 }
});
