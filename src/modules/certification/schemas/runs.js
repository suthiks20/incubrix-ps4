/**
 * Validates the narrowly scoped certification-run list filters.
 * Additional filters are rejected to keep the endpoint contract stable.
 */
module.exports = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      destination_id: { type: 'string', format: 'uuid' },
      status: { enum: ['passed', 'failed', 'cleanup_pending'] },
      limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      offset: { type: 'integer', minimum: 0, default: 0 }
    }
  }
};
