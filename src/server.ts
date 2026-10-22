/**
 * Starts the HTTP server and owns graceful process shutdown signals.
 * No other file calls listen, which keeps application tests in-process.
 */
import buildApp = require('./app');
import config = require('./config');
import { runMigrations } from './db/migrate';
import { purgeExpired } from './shared/idempotency/repository';
const app = buildApp();

async function closeServer(signal: string): Promise<void> {
  app.log.info({ signal }, 'Closing server');
  await app.close();
  await app.knex.destroy();
  process.exit(0);
}
process.on('SIGTERM', () => closeServer('SIGTERM'));
process.on('SIGINT', () => closeServer('SIGINT'));
async function startServer(): Promise<void> {
  if (config.DB_AUTO_MIGRATE) await runMigrations(app.knex, app.log);
  const purgedCount = await purgeExpired(app.knex);
  app.log.info({ purged_count: purgedCount }, 'Expired idempotency keys purged');
  await app.listen({ port: config.PORT, host: config.HOST });
}

startServer().catch(async (error: any) => {
  app.log.error({ err: error }, 'Unable to start server');
  await app.knex.destroy();
  process.exit(1);
});
