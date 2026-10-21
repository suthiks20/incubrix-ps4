/**
 * Validates destination list filters and pagination query parameters.
 * The response includes a page and the total count before pagination.
 */
const { LEVELS } = require('../commons/constants');
const { responseProperties } = require('./destination');
module.exports = {
  querystring: { type: 'object', additionalProperties: false, properties: {
    platform_key: { type: 'string' }, connector_key: { type: 'string' }, level: { type: 'string', enum: LEVELS },
    enabled: { type: 'boolean' }, demoted: { type: 'boolean' }, language: { type: 'string' },
    limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 }, offset: { type: 'integer', minimum: 0, default: 0 }
  } },
  response: { 200: { type: 'object', required: ['items', 'total', 'limit', 'offset'], properties: {
    items: { type: 'array', items: { type: 'object', additionalProperties: false, properties: responseProperties } },
    total: { type: 'integer' }, limit: { type: 'integer' }, offset: { type: 'integer' }
  } } }
};
