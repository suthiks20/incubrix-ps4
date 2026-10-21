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
const registerErrorHandlers = require('./shared/errors/errorHandler');
const healthRoutes = require('./modules/health/routes');
const destinationRoutes = require('./modules/destinations/routes');
const config = require('./config');

function buildApp(opts = {}) {
  const appConfig = opts.config || config;
  const app = Fastify({
    logger: opts.logger === false ? false : logger,
    ajv: { customOptions: { removeAdditional: false } },
    genReqId: (request) => request.headers['x-correlation-id'] || crypto.randomUUID(),
    logController: new LogController({ requestIdLogLabel: 'correlation_id' })
  });
  app.decorate('knex', opts.knex || knex);
  correlationId(app);
  auth(app, { apiToken: opts.apiToken === undefined ? appConfig.API_TOKEN : opts.apiToken });
  registerErrorHandlers(app);
  app.register(healthRoutes);
  app.register(destinationRoutes);
  return app;
}

module.exports = buildApp;
