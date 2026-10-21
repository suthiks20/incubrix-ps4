/**
 * Reads a destination ID and partial update body, then sends the result.
 * The service performs duplicate and secret checks before repository writes.
 */
const { update } = require('../services/update');
async function updateHandler(request, reply) { return reply.send(await update(request.server.knex, request.params.id, request.body)); }
module.exports = updateHandler;
