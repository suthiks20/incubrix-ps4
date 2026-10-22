/**
 * Loads one stored evidence document through the service-level run lookup.
 * The storage file is parsed only after the run is known to exist.
 */
const reads = require('../services/reads');
async function getEvidence(request) {
  return reads.getEvidence(request.server.knex, request.server.storage, request.params.id);
}
module.exports = getEvidence;
