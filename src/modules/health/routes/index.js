/**
 * Routes follow route -> handler -> service -> repository layering: routes declare HTTP,
 * handlers adapt Fastify, services own logic, and repositories contain Knex queries.
 */
const handlers = require('../handlers');
const schemas = require('../schemas');
async function healthRoutes(app) {
  const health = { schema: schemas.health, handler: handlers.healthHandler };
  const ready = { schema: schemas.ready, handler: handlers.readyHandler };
  app.get('/health', health);
  app.get('/ready', ready);
  app.get('/api/v1/health', health);
  app.get('/api/v1/ready', ready);
}
module.exports = healthRoutes;
