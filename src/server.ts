/**
 * Starts the HTTP server and owns graceful process shutdown signals.
 * No other file calls listen, which keeps application tests in-process.
 */
import buildApp = require('./app');
import config = require('./config');
import { runMigrations } from './db/migrate';
import { purgeExpired } from './shared/idempotency/repository';
import { runCleanup } from './modules/certification/services/cleanup';
import { runPending } from './modules/jobs/worker';
import { seedDemoDestinations } from './modules/seed/demo';
const app = buildApp();
let cleanupTimer: ReturnType<typeof setInterval> | undefined;
let jobsTimer: ReturnType<typeof setInterval> | undefined;

function cleanupDeps(): any {
  return {
    knex: app.knex,
    config: app.config,
    logger: app.log,
    storage: app.storage,
    now: () => new Date(),
    connectorFactory: app.connectorFactory,
    app
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

function startJobs(): void {
  jobsTimer = setInterval(() => { void runPending(cleanupDeps()); }, app.config.JOBS_POLL_INTERVAL_MS);
  jobsTimer.unref();
}

async function closeServer(signal: string): Promise<void> {
  app.log.info({ signal }, 'Closing server');
  if (cleanupTimer) clearInterval(cleanupTimer);
  if (jobsTimer) clearInterval(jobsTimer);
  await app.close();
  await app.knex.destroy();
  process.exit(0);
}
process.on('SIGTERM', () => closeServer('SIGTERM'));
process.on('SIGINT', () => closeServer('SIGINT'));
async function startServer(): Promise<void> {
  if (config.DB_AUTO_MIGRATE) await runMigrations(app.knex, app.log);
  if (config.SEED_DEMO && config.SIMULATION_MODE) {
    const mockRoot = `http://127.0.0.1:${config.PORT}/mock`;
    const count = await seedDemoDestinations(app.knex, config, mockRoot);
    app.log.info({ demo_destinations: count }, 'Simulation destinations seeded');
  }
  const purgedCount = await purgeExpired(app.knex);
  app.log.info({ purged_count: purgedCount }, 'Expired idempotency keys purged');
  await runJanitor();
  await repositoryRecover();
  startJanitor();
  startJobs();
  await app.listen({ port: config.PORT, host: config.HOST });
}

startServer().catch(async (error: any) => {
  app.log.error({ err: error }, 'Unable to start server');
  await app.knex.destroy();
  process.exit(1);
});

async function repositoryRecover(): Promise<void> {
  const repository = await import('./modules/jobs/repository');
  await repository.recoverStale(app.knex, app.config);
}
