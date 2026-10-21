/**
 * Adapts connector contract requests to the connector service.
 * It contains no connector policy or database queries of its own.
 */
const { execute } = require('../services/contract');
async function handler(request, reply) {
  const result = await execute(request.server, request.params.key, request.params.method, request.body || {});
  if (result.replay) reply.header('Idempotent-Replay', 'true');
  return result;
}
module.exports = handler;
