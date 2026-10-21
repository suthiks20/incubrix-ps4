/**
 * Builds the Fastify application without opening a network listener.
 * Tests use this factory with app.inject while server.js owns process startup.
 */
const Fastify = require('fastify');
const { LogController } = require('fastify');
const crypto = require('crypto');
const knex = require('./db/knex');
const logger = require('./shared/logger');
const correlationId = require('./shared/plugins/correlationId');
const auth = require('./shared/plugins/auth');
const idempotency = require('./shared/plugins/idempotency');
const registerErrorHandlers = require('./shared/errors/errorHandler');
const healthRoutes = require('./modules/health/routes');
const destinationRoutes = require('./modules/destinations/routes');
const connectorRoutes = require('./modules/connectors/routes');
const rulesRoutes = require('./modules/rules/routes');
const { loadManifests } = require('./modules/connectors/manifestLoader');
const discourseMock = require('./mocks/discourse');
const webhookMock = require('./mocks/webhook');
const config = require('./config');
const { createStorage } = require('./shared/storage');
const certificationRoutes = require('./modules/certification/routes');

function buildApp(opts = {}) {
  const appConfig = opts.config || config;
  const logging = opts.logger === false
    ? { logger: false }
    : opts.logger && typeof opts.logger.info === 'function'
      ? { loggerInstance: opts.logger }
      : { logger: opts.logger || logger };
  const app = Fastify({
    ...logging,
    ajv: { customOptions: { removeAdditional: false } },
    genReqId: (request) => request.headers['x-correlation-id'] || crypto.randomUUID(),
    // Fastify's LogController customizes its internal request log lines.
    // This label makes each request log carry the correlation_id field.
    logController: new LogController({ requestIdLogLabel: 'correlation_id' })
  });
  app.decorate('knex', opts.knex || knex);
  app.decorate('config', appConfig);
  app.decorate('storage', opts.storage || createStorage(appConfig));
  app.decorate('now', opts.now || (() => new Date()));
  app.decorate('connectorFactory', opts.connectorFactory || null);
  loadManifests();
  correlationId(app);
  auth(app, { apiToken: opts.apiToken === undefined ? appConfig.API_TOKEN : opts.apiToken });
  idempotency(app, appConfig);
  registerErrorHandlers(app);
  app.register(healthRoutes);
  app.register(destinationRoutes);
  app.register(connectorRoutes);
  app.register(rulesRoutes);
  app.register(certificationRoutes);
  if (appConfig.SIMULATION_MODE) { app.register(discourseMock); app.register(webhookMock); }
  return app;
}

module.exports = buildApp;
