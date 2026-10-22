/**
 * Adapts a certification creation request to the run service dependencies.
 * The route schema validates its UUID before this handler runs.
 */
const { runCertification } = require('../services/run');
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

async function certify(request) {
  return runCertification(deps(request.server), request.params.id);
}
module.exports = certify;
