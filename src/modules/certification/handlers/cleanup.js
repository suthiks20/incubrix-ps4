/**
 * Adapts one cleanup request to the janitor service's explicit dependencies.
 * The global POST hook has already validated its Idempotency-Key before this point.
 */
const { runCleanup } = require('../services/cleanup');

function deps(app) {
  return {
    knex: app.knex,
    config: app.config,
    logger: app.log,
    storage: app.storage,
    now: app.now,
    connectorFactory: app.connectorFactory
  };
}

async function cleanup(request) {
  return runCleanup(deps(request.server));
}

module.exports = cleanup;
