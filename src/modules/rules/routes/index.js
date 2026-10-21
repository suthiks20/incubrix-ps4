/**
 * Registers the policy dry-run endpoint under the versioned API prefix.
 * Request handling is delegated to the rules handler and service.
 */
const handler = require('../handlers/evaluate');
async function routes(app) {
  app.post('/api/v1/rules/evaluate', { schema: { body: { type: 'object', required: ['rendition', 'destination'], additionalProperties: false, properties: { rendition: { type: 'object', additionalProperties: true }, destination: { type: 'object', additionalProperties: true }, history: { type: 'object', additionalProperties: false, properties: { published_at: { type: 'array', items: { type: 'string' } } } } } } }, handler);
}
module.exports = routes;
