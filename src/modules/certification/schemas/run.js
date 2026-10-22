/**
 * Validates a certification run identifier used by read endpoints.
 * Evidence and run reads share this exact UUID route parameter contract.
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
