/**
 * Claims and replays keys for versioned API POST requests using Fastify hooks.
 * It runs after authentication so rejected requests never leave stored claims.
 */
const { assertValidKey } = require('../idempotency/keyValidation');
const { requestHash } = require('../idempotency/hash');
const service = require('../idempotency/service');

function requestPath(request) {
  return request.raw.url.split('?')[0];
}

function parsePayload(payload) {
  const value = Buffer.isBuffer(payload) ? payload.toString() : payload;
  if (typeof value !== 'string') return value === undefined ? null : value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function idempotency(app, config) {
  app.addHook('preValidation', async (request, reply) => {
    const path = requestPath(request);
    if (request.method !== 'POST' || !path.startsWith('/api/v1')) return;

    const key = assertValidKey(request.headers['idempotency-key']);
    const method = request.method.toUpperCase();
    const hash = requestHash(method, path, request.raw.url.split('?')[1] || '', request.body);
    const result = await service.begin(app.knex, config, { key, method, path, requestHash: hash });
    if (result.action === 'replay') {
      reply.code(result.row.response_status);
      if (result.row.response_content_type) reply.header('content-type', result.row.response_content_type);
      reply.header('Idempotent-Replay', 'true');
      return reply.send(result.row.response_body);
    }
    request.idempotencyContext = { key, method, path, requestHash: hash };
  });

  app.addHook('onSend', async (request, reply, payload) => {
    const context = request.idempotencyContext;
    if (!context) return payload;
    try {
      const header = reply.getHeader('content-type');
      await service.finish(app.knex, context, {
        statusCode: reply.statusCode,
        body: parsePayload(payload),
        contentType: header ? String(header) : null
      });
    } catch (error) {
      request.log.error({ err: error, idempotency_key: context.key }, 'Unable to save idempotency response');
    }
    return payload;
  });
}

// /connector/v1 is excluded because its connector contract carries idempotency_key in JSON;
// the connector runtime will enforce that contract in a later phase.
module.exports = idempotency;
