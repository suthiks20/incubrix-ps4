/**
 * Re-exports certification request handlers for the route module.
 * Routes remain declarative while handlers adapt Fastify requests.
 */
const { runCertification } = require('../services/run'); const runs = require('../repository/runs'); const alerts = require('../services/alerts');
function deps(app) { return { knex: app.knex, config: app.config, logger: app.log, storage: app.storage, now: app.now, connectorFactory: app.connectorFactory }; }
async function certify(request) { return runCertification(deps(request.server), request.params.id); }
async function getRuns(request) { return runs.list(request.server.knex, request.query); }
async function getRun(request) { return runs.findById(request.server.knex, request.params.id); }
async function getEvidence(request) { const run = await runs.findById(request.server.knex, request.params.id); return run ? JSON.parse((await request.server.storage.get(run.evidence_key)).toString()) : null; }
async function getAlerts(request) { return alerts.list(request.server.knex, request.query); }
async function acknowledgeAlert(request) { return alerts.acknowledge(request.server.knex, request.params.id); }
module.exports = { certify, getRuns, getRun, getEvidence, getAlerts, acknowledgeAlert };
