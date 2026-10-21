/**
 * Validates partial destination updates and the updated resource response.
 * At least one known field is required and unknown fields are rejected.
 */
const { requestProperties, responseProperties } = require('./destination');
module.exports = {
  params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
  body: { type: 'object', minProperties: 1, additionalProperties: false, properties: requestProperties },
  response: { 200: { type: 'object', additionalProperties: false, properties: responseProperties } }
};
