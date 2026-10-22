/**
 * Loads one certification run through the service-level not-found check.
 * This keeps a missing run from becoming a successful empty response.
 */
const reads = require('../services/reads');
async function getRun(request) { return reads.getRun(request.server.knex, request.params.id); }
module.exports = getRun;
