/**
 * Validates the destination identifier accepted by certification creation.
 * Fastify rejects malformed identifiers before invoking certification services.
 */
module.exports = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' }
    }
  }
};
