/**
 * Registers certification run and stored-evidence HTTP endpoints.
 * Handlers delegate all persistence and connector work to certification services.
 */
const handlers = require('../handlers');
const schemas = require('../schemas');
async function routes(app) {
  app.post('/api/v1/destinations/:id/certify', { schema: schemas.certify }, handlers.certify);
  app.get('/api/v1/certification/runs', { schema: schemas.runs }, handlers.getRuns);
  app.get('/api/v1/certification/runs/:id', { schema: schemas.run }, handlers.getRun);
  app.get(
    '/api/v1/certification/runs/:id/evidence',
    { schema: schemas.evidence },
    handlers.getEvidence
  );
  app.get('/api/v1/alerts', { schema: schemas.alerts }, handlers.getAlerts);
  app.post(
    '/api/v1/alerts/:id/acknowledge',
    { schema: schemas.acknowledgeAlert },
    handlers.acknowledgeAlert
  );
  app.post('/api/v1/certification/cleanup', { schema: schemas.cleanup }, handlers.cleanup);
  app.get('/api/v1/certification/summary', { schema: schemas.summary }, handlers.getSummary);
}
module.exports = routes;
