/**
 * Exposes the tailoring endpoint under the API v1 namespace.
 */

const service = require('../index');

async function tailorHandler(request: any) {
  const { destination, rendition } = request.body || {};
  return service.tailorRendition(destination || {}, rendition || {});
}

function routes(app: any): void {
  app.post('/api/v1/tailor', {
    schema: {
      body: {
        type: 'object',
        required: ['destination', 'rendition'],
        properties: {
          destination: { type: 'object', additionalProperties: true },
          rendition: { type: 'object', additionalProperties: true }
        }
      }
    }
  }, tailorHandler);
}

export = routes;
