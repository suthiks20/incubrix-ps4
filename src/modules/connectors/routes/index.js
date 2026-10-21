/**
 * Registers connector contract and catalogue endpoints.
 * Route -> handler -> service -> repository keeps protocol concerns separated from logic.
 */
const handlers = require('../handlers');
const schemas = require('../schemas');
const registry = require('../registry');
async function routes(app) {
  app.post('/connector/v1/:key/:method', { schema: { body: schemas.contract.body } }, handlers.contract);
  app.get('/api/v1/connectors', async () => [...registry.values()].map(({ manifest }) => ({ key: manifest.key, version: manifest.version, tier: manifest.tier, capabilities: manifest.capabilities, surfaces: Object.keys(manifest.surfaces) })));
}
module.exports = routes;
