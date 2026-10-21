/**
 * Runs pending database migrations through the provided Knex instance.
 * The caller may provide Fastify's logger to record applied migration names.
 */
const path = require('path');

async function runMigrations(knex, logger = { info: () => {} }) {
  const [batch, names] = await knex.migrate.latest({ directory: path.join(__dirname, 'migrations'), tableName: 'knex_migrations' });
  if (names.length) logger.info({ batch, migrations: names }, 'Database migrations applied');
  return [batch, names];
}

module.exports = { runMigrations };
