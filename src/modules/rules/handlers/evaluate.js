/**
 * Reads a dry-run policy request and sends its decision to the client.
 * The handler delegates history and evaluation work to the rules service.
 */
const service = require('../service');
async function evaluate(request) { return service.run(request.server.knex, request.body, request.body.destination.connector_key || 'discourse'); }
module.exports = evaluate;
