/**
 * Loads published history when a dry run does not supply it.
 * Policy evaluation itself remains in the pure rules engine.
 */
const { evaluate } = require('./engine');
const ledger = require('../ledger/service');
const { destinationRef } = require('../connectors/commons/destinationRef');
async function run(knex, input, connectorKey = 'discourse') {
  const baseDestination = input.destination || {};
  const currentDestination = input.proposed_rules && input.proposed_rules.status === 'CONFIRMED'
    ? { ...baseDestination, ...input.proposed_rules.rules }
    : baseDestination;
  let history = input.history;
  if (!history) {
    const days = currentDestination.frequency_cap && currentDestination.frequency_cap.per_days || 36500;
    const since = new Date(Date.now() - Number(days) * 86400000).toISOString();
    history = { published_at: await ledger.publishedTimes(knex, connectorKey, destinationRef(currentDestination), since) };
  }
  return evaluate({ ...input, destination: currentDestination, history, now: input.now || new Date().toISOString() });
}
module.exports = { run };
