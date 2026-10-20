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
const registerErrorHandlers = require('./shared/errors/errorHandler');
const healthRoutes = require('./modules/health/routes');

function buildApp(opts = {}) {
  const app = Fastify({
    logger: opts.logger === false ? false : logger,
    genReqId: (request) => request.headers['x-correlation-id'] || crypto.randomUUID(),
    logController: new LogController({ requestIdLogLabel: 'correlation_id' })
  });
  app.decorate('knex', opts.knex || knex);
  correlationId(app);
  registerErrorHandlers(app);
  app.register(healthRoutes);
  return app;
}

module.exports = buildApp;
