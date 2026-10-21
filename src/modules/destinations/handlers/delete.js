/**
 * Reads the destination ID and sends the hard-delete confirmation.
 * Missing records are reported by the service layer as NOT_FOUND.
 */
const { remove } = require('../services/delete');
async function deleteHandler(request, reply) { return reply.send(await remove(request.server.knex, request.params.id)); }
module.exports = deleteHandler;
