/**
 * Registers certification run and stored-evidence HTTP endpoints.
 * Handlers delegate all persistence and connector work to certification services.
 */
const handlers = require('../handlers');
async function routes(app) {
  app.post('/api/v1/destinations/:id/certify', handlers.certify);
  app.get('/api/v1/certification/runs', handlers.getRuns);
  app.get('/api/v1/certification/runs/:id', handlers.getRun);
  app.get('/api/v1/certification/runs/:id/evidence', handlers.getEvidence);
  app.get('/api/v1/alerts', handlers.getAlerts);
  app.post('/api/v1/alerts/:id/acknowledge', handlers.acknowledgeAlert);
}
module.exports = routes;
