/**
 * Accepts a rules capture request and returns the queued proposal.
 */
const { captureRules } = require('../services/rulesCapture');

async function rulesCaptureHandler(request, reply) {
  const payload = request.body || {};
  const result = await captureRules(request.server.knex, request.params.id, payload, request.server);
  return reply.send(result);
}

module.exports = rulesCaptureHandler;
