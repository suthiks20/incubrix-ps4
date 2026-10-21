/**
 * Loads published history when a dry run does not supply it.
 * Policy evaluation itself remains in the pure rules engine.
 */
const { evaluate } = require('./engine');
const ledger = require('../ledger/service');
async function run(knex, input, connectorKey = 'discourse') {
  let history = input.history;
  if (!history) {
    const days = input.destination.frequency_cap && input.destination.frequency_cap.per_days || 36500;
    const since = new Date(Date.now() - Number(days) * 86400000).toISOString();
    const destinationRef = input.destination.config && input.destination.config.base_url || input.destination.url || '';
    history = { published_at: await ledger.publishedTimes(knex, connectorKey, destinationRef.toLowerCase(), since) };
  }
  return evaluate({ ...input, history, now: input.now || new Date().toISOString() });
}
module.exports = { run };
