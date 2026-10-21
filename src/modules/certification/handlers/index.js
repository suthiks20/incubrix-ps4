/**
 * Adapts certification HTTP requests to the certification services.
 * Routes stay declarative while these handlers build the dependencies each service needs.
 */
const { runCertification } = require('../services/run');
const runs = require('../repository/runs');
const alerts = require('../services/alerts');

function buildDeps(app) {
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
  return runCertification(buildDeps(request.server), request.params.id);
}

async function getRuns(request) {
  return runs.list(request.server.knex, request.query);
}

async function getRun(request) {
  return runs.findById(request.server.knex, request.params.id);
}

async function getEvidence(request) {
  const run = await runs.findById(request.server.knex, request.params.id);
  if (!run) return null;
  const file = await request.server.storage.get(run.evidence_key);
  return JSON.parse(file.toString());
}

async function getAlerts(request) {
  return alerts.list(request.server.knex, request.query);
}

async function acknowledgeAlert(request) {
  return alerts.acknowledge(request.server.knex, request.params.id);
}

module.exports = { certify, getRuns, getRun, getEvidence, getAlerts, acknowledgeAlert };
