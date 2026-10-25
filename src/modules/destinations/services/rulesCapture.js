/**
 * Captures a pending rule proposal for a destination.
 * The storage is in-memory and intentionally simple for the assessment.
 */
const AppError = require('../../../shared/errors/AppError');
const llm = require('../../../llm');
const { getById } = require('./getById');

async function captureRules(knex, destinationId, payload, server) {
  if (!payload || typeof payload !== 'object') throw new AppError('VALIDATION_ERROR', 'Rules capture payload is required', { statusCode: 400 });
  const destination = await getById(knex, destinationId);
  const provider = server?.config?.LLM_PROVIDER || 'mock';
  const proposal = await llm.getAdapter(provider).captureRules({
    rules_text: payload.rules_text || payload.text || '',
    url: payload.url || ''
  }, { config: server.config });
  server.ruleProposals.set(destinationId, { ...proposal, destination_id: destinationId, status: 'PENDING' });
  return {
    destination_id: destination.id,
    proposal_id: proposal.id,
    status: 'PENDING',
    rules: proposal.rules,
    provider: proposal.provider || provider,
    model: proposal.model,
    latency_ms: proposal.latency_ms,
    evidence: proposal.evidence,
    source: payload.url || null,
    created_at: proposal.created_at
  };
}

module.exports = { captureRules };
