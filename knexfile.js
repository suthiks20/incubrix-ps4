/**
 * Shares the application's PostgreSQL connection and migration location with Knex CLI.
 * Migrations stay in source control and are applied explicitly or at server startup.
 */
const config = require('./src/config');
module.exports = {
  client: 'pg',
  connection: config.DATABASE_URL,
  migrations: { directory: './src/db/migrations', tableName: 'knex_migrations' }
};
