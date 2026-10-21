/**
 * Normalizes the stable destination identity shared by rules and the ledger.
 * Keeping it here prevents dry runs and publishes from using different keys.
 */
function destinationRef(destination = {}) {
  const value = destination.config && destination.config.base_url || destination.base_url || destination.url || '';
  return String(value).replace(/\/+$/, '').toLowerCase();
}

module.exports = { destinationRef };
