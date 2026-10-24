/**
 * Registers connector contract and catalogue endpoints.
 * Route -> handler -> service -> repository keeps protocol concerns separated from logic.
 */
const handlers = require('../handlers');
const schemas = require('../schemas');
const registry = require('../registry');
const destinations = require('../../destinations/repository/destinations');
const mrssFeed = require('../mrss/feedStore');
const AppError = require('../../../shared/errors/AppError');

function scenarioFor(destination) {
  const baseUrl = destination.config && destination.config.base_url || '';
  return new URL(baseUrl).pathname.split('/').filter(Boolean).pop() || 'normal';
}

async function routes(app) {
  app.post('/connector/v1/:key/:method', { schema: { body: schemas.contract.body } }, handlers.contract);
  app.get('/feeds/:destination_id.xml', async (request, reply) => {
    const destination = await destinations.findById(app.knex, request.params.destination_id);
    if (!destination || destination.connector_key !== 'mrss') {
      throw new AppError('NOT_FOUND', 'MRSS destination not found', { statusCode: 404 });
    }
    const items = mrssFeed.list(scenarioFor(destination), destination.id);
    const xml = mrssFeed.renderFeed(destination.name, destination.url, items);
    return reply.type('application/rss+xml; charset=utf-8').send(xml);
  });
  app.get('/api/v1/connectors', async () => [...registry.values()].map(({ manifest }) => ({ key: manifest.key, version: manifest.version, tier: manifest.tier, capabilities: manifest.capabilities, surfaces: manifest.surfaces.map((surface) => surface.key) })));
}
module.exports = routes;
