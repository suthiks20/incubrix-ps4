/**
 * Routes follow route -> handler -> service -> repository layering: routes declare HTTP,
 * handlers adapt Fastify, services own logic, and repositories contain Knex queries.
 */
const handlers = require('../handlers');
const schemas = require('../schemas');

async function destinationRoutes(app) {
  app.post('/api/v1/destinations', { schema: schemas.create }, handlers.create);
  app.get('/api/v1/destinations', { schema: schemas.getAll }, handlers.getAll);
  app.get('/api/v1/destinations/:id', { schema: schemas.getById }, handlers.getById);
  app.put('/api/v1/destinations/:id', { schema: schemas.update }, handlers.update);
  app.delete('/api/v1/destinations/:id', { schema: schemas.delete }, handlers.delete);
  app.post('/api/v1/destinations/:id/rules/capture', handlers.captureRules);
  app.post('/api/v1/destinations/:id/rules/confirm', handlers.confirmRules);
}

module.exports = destinationRoutes;
