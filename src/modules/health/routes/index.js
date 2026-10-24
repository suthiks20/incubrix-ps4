/**
 * Routes follow route -> handler -> service -> repository layering: routes declare HTTP,
 * handlers adapt Fastify, services own logic, and repositories contain Knex queries.
 */
const handlers = require('../handlers');
const schemas = require('../schemas');
const fs = require('fs');
const path = require('path');

async function healthRoutes(app) {
  const health = { schema: schemas.health, handler: handlers.healthHandler };
  const ready = { schema: schemas.ready, handler: handlers.readyHandler };
  app.get('/', async () => {
    const metadata = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    return {
      name: metadata.name,
      version: metadata.version,
      mode: app.config.SIMULATION_MODE ? 'simulation' : 'live',
      links: {
        health: '/health',
        ready: '/ready',
        openapi: '/openapi.yaml',
        reviewer_guide: '/README.md#reviewer-guide'
      }
    };
  });
  app.get('/openapi.yaml', async (_request, reply) => {
    const spec = fs.readFileSync(path.join(process.cwd(), 'openapi.yaml'));
    return reply.type('application/yaml; charset=utf-8').send(spec);
  });
  app.get('/health', health);
  app.get('/ready', ready);
  app.get('/api/v1/health', health);
  app.get('/api/v1/ready', ready);
}
module.exports = healthRoutes;
