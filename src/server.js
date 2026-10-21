/**
 * Starts the HTTP server and owns graceful process shutdown signals.
 * No other file calls listen, which keeps application tests in-process.
 */
const buildApp = require('./app');
const config = require('./config');
const { runMigrations } = require('./db/migrate');
const app = buildApp();

async function closeServer(signal) {
  app.log.info({ signal }, 'Closing server');
  await app.close();
  await app.knex.destroy();
  process.exit(0);
}
process.on('SIGTERM', () => closeServer('SIGTERM'));
process.on('SIGINT', () => closeServer('SIGINT'));
async function startServer() {
  if (config.DB_AUTO_MIGRATE) await runMigrations(app.knex, app.log);
  await app.listen({ port: config.PORT, host: config.HOST });
}

startServer().catch(async (error) => {
  app.log.error({ err: error }, 'Unable to start server');
  await app.knex.destroy();
  process.exit(1);
});
