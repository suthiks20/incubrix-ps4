/**
 * Registers certification run and stored-evidence HTTP endpoints.
 * Handlers delegate all persistence and connector work to certification services.
 */
const { runCertification } = require('../services/run'); const repo = require('../repository');
const alerts = require('../services/alerts');
async function routes(app) {
  app.post('/api/v1/destinations/:id/certify', async (request) => runCertification({ knex: app.knex, config: app.config, logger: app.log, storage: app.storage, now: app.now, connectorFactory: app.connectorFactory }, request.params.id));
  app.get('/api/v1/certification/runs', async (request) => repo.findAll(app.knex, Object.fromEntries(Object.entries(request.query).filter(([, value]) => value !== undefined))));
  app.get('/api/v1/certification/runs/:id', async (request) => repo.findById(app.knex, request.params.id));
  app.get('/api/v1/certification/runs/:id/evidence', async (request) => { const run = await repo.findById(app.knex, request.params.id); if (!run) return null; return JSON.parse((await app.storage.get(run.evidence_key)).toString()); });
  app.get('/api/v1/alerts', async (request) => alerts.list(app.knex, Object.fromEntries(Object.entries(request.query).filter(([, value]) => value !== undefined))));
  app.post('/api/v1/alerts/:id/acknowledge', async (request) => alerts.acknowledge(app.knex, request.params.id));
}
module.exports = routes;
