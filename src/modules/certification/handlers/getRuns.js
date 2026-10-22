/**
 * Returns schema-validated certification run filters through the repository.
 * Listing has no business decisions beyond the public query contract.
 */
const runs = require('../repository/runs');
async function getRuns(request) { return runs.list(request.server.knex, request.query); }
module.exports = getRuns;
