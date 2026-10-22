/**
 * Validates the alert UUID accepted by the acknowledgement endpoint.
 * The endpoint also relies on the global POST idempotency hook.
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
