/**
 * Confirms a pending rule proposal so later decisions use it.
 */
const AppError = require('../../../shared/errors/AppError');
const llm = require('../../../llm');

async function confirmRules(knex, destinationId, payload, server) {
  const existing = server.ruleProposals.get(destinationId);
  if (!existing) throw new AppError('RULES_PROPOSAL_NOT_FOUND', 'No pending proposal for this destination', { statusCode: 404 });
  const proposed = llm.confirmRulesProposal(existing);
  server.ruleProposals.set(destinationId, proposed);
  return {
    destination_id: destinationId,
    proposal_id: proposed.id,
    status: 'CONFIRMED',
    rules: proposed.rules,
    confirmed_at: proposed.confirmed_at
  };
}

module.exports = { confirmRules };
