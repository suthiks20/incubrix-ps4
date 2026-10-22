/**
 * Lists certification alerts using the route's explicit filter schema.
 * Alert service behavior remains independent from HTTP request details.
 */
const alerts = require('../services/alerts');
async function getAlerts(request) { return alerts.list(request.server.knex, request.query); }
module.exports = getAlerts;
