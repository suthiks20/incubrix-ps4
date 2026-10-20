/**
 * Defines the liveness response contract used by Fastify's AJV serializer.
 * A closed query schema also gives Phase 1 a validation-error test path.
 */
module.exports = {
  querystring: { type: 'object', additionalProperties: false, properties: { probe: { type: 'integer' } } },
  response: { 200: { type: 'object', required: ['status', 'service', 'version', 'uptime_seconds'], properties: {
    status: { type: 'string' }, service: { type: 'string' }, version: { type: 'string' }, uptime_seconds: { type: 'integer' }
  } } }
};
