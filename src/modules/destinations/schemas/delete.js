/**
 * Validates the UUID path parameter for hard deletion.
 * The response confirms that a record was removed.
 */
module.exports = {
  params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
  response: { 200: { type: 'object', required: ['deleted'], properties: { deleted: { type: 'boolean' } } } }
};
