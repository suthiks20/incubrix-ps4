/**
 * Starts the HTTP server and owns graceful process shutdown signals.
 * No other file calls listen, which keeps application tests in-process.
 */
import buildApp = require('./app');
import config = require('./config');
import { runMigrations } from './db/migrate';
import { purgeExpired } from './shared/idempotency/repository';
import { runCleanup } from './modules/certification/services/cleanup';
const app = buildApp();
let cleanupTimer: ReturnType<typeof setInterval> | undefined;

function cleanupDeps(): any {
  return {
    knex: app.knex,
    config: app.config,
    logger: app.log,
    storage: app.storage,
    now: () => new Date(),
    connectorFactory: app.connectorFactory
  };
}

async function runJanitor(): Promise<void> {
  try {
    await runCleanup(cleanupDeps());
  } catch (error: any) {
    app.log.error({ err: error }, 'Certification cleanup janitor failed');
  }
}

function startJanitor(): void {
  const delay = app.config.CERT_JANITOR_INTERVAL_SECONDS * 1000;
  cleanupTimer = setInterval(() => { void runJanitor(); }, delay);
  cleanupTimer.unref();
}

async function closeServer(signal: string): Promise<void> {
  app.log.info({ signal }, 'Closing server');
  if (cleanupTimer) clearInterval(cleanupTimer);
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
  await runJanitor();
  startJanitor();
  await app.listen({ port: config.PORT, host: config.HOST });
}

startServer().catch(async (error: any) => {
  app.log.error({ err: error }, 'Unable to start server');
  await app.knex.destroy();
  process.exit(1);
});
