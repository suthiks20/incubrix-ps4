/**
 * Acknowledges one alert through the service-level not-found check.
 * The POST idempotency hook runs before this handler.
 */
const alerts = require('../services/alerts');
async function acknowledgeAlert(request) {
  return alerts.acknowledge(request.server.knex, request.params.id);
}
module.exports = acknowledgeAlert;
