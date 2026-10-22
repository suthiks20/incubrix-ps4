/**
 * Validates the public alert list filters without allowing arbitrary queries.
 * Boolean acknowledgement filtering is parsed by Fastify before service access.
 */
module.exports = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      destination_id: { type: 'string', format: 'uuid' },
      acknowledged: { type: 'boolean' }
    }
  }
};
