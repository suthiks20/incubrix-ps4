/**
 * Builds the Fastify application without opening a network listener.
 * Tests use this factory with app.inject while server.js owns process startup.
 */
import Fastify, { LogController } from 'fastify';
import crypto from 'crypto';
import knex = require('./db/knex');
import logger = require('./shared/logger');
import correlationId = require('./shared/plugins/correlationId');
import auth = require('./shared/plugins/auth');
import idempotency = require('./shared/plugins/idempotency');
import registerErrorHandlers = require('./shared/errors/errorHandler');
import healthRoutes = require('./modules/health/routes');
import destinationRoutes = require('./modules/destinations/routes');
import connectorRoutes = require('./modules/connectors/routes');
import rulesRoutes = require('./modules/rules/routes');
import { loadManifests } from './modules/connectors/manifestLoader';
import discourseMock = require('./mocks/discourse');
import webhookMock = require('./mocks/webhook');
import config = require('./config');
import { createStorage } from './shared/storage';
import certificationRoutes = require('./modules/certification/routes');
import jobRoutes = require('./modules/jobs/routes');

function buildApp(opts: any = {}): any {
  const appConfig = opts.config || config;
  const logging = opts.logger === false
    ? { logger: false }
    : opts.logger && typeof opts.logger.info === 'function'
      ? { loggerInstance: opts.logger }
      : { logger: opts.logger || logger };
  const app = Fastify({
    ...logging,
    ajv: { customOptions: { removeAdditional: false } },
    genReqId: (request) => (request.headers['x-correlation-id'] as string) || crypto.randomUUID(),
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
  app.register(jobRoutes);
  if (appConfig.SIMULATION_MODE) { app.register(discourseMock); app.register(webhookMock); }
  return app;
}

export = buildApp;
