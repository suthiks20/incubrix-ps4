/**
 * Defines strict schemas for job creation and inspection endpoints.
 * Fastify validates external shapes before handlers invoke job services.
 */
const uuid = { type: 'string', format: 'uuid' };
const create = { body: { type: 'object', required: ['type', 'input'], additionalProperties: false,
  properties: { type: { type: 'string' }, input: { type: 'object' }, callback_url: { type: 'string' } } } };
const get = { params: { type: 'object', required: ['id'], properties: { id: uuid } } };
const list = { querystring: { type: 'object', additionalProperties: false, properties: {
  status: { enum: ['queued', 'running', 'succeeded', 'failed'] }, type: { type: 'string' },
  limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 } } } };
export { create, get, list };
