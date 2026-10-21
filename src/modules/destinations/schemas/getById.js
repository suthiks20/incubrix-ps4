/**
 * Validates the UUID path parameter for destination retrieval.
 * Response serialization uses the shared full destination contract.
 */
const { responseProperties } = require('./destination');
module.exports = {
  params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
  response: { 200: { type: 'object', additionalProperties: false, properties: responseProperties } }
};
