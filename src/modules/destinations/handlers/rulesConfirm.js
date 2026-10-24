/**
 * Confirms a pending rule proposal and applies the stored rules.
 */
const { confirmRules } = require('../services/rulesConfirm');

async function rulesConfirmHandler(request, reply) {
  const result = await confirmRules(request.server.knex, request.params.id, request.body || {}, request.server);
  return reply.send(result);
}

module.exports = rulesConfirmHandler;
