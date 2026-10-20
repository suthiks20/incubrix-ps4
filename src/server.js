/**
 * Starts the HTTP server and owns graceful process shutdown signals.
 * No other file calls listen, which keeps application tests in-process.
 */
const buildApp = require('./app');
const config = require('./config');
const app = buildApp();

async function closeServer(signal) {
  app.log.info({ signal }, 'Closing server');
  await app.close();
  await app.knex.destroy();
  process.exit(0);
}
process.on('SIGTERM', () => closeServer('SIGTERM'));
process.on('SIGINT', () => closeServer('SIGINT'));
app.listen({ port: config.PORT, host: config.HOST }).catch((error) => {
  app.log.error({ err: error }, 'Unable to start server');
  process.exit(1);
});
