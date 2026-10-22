/**
 * Creates the shared Knex client from validated application configuration.
 * Repositories receive this client and contain the actual SQL calls.
 */
import knexFactory from 'knex';
import config = require('../config');

const knex = knexFactory({
  client: 'pg',
  connection: config.DATABASE_URL,
  pool: { min: 0, max: 5 }
});

export = knex;
