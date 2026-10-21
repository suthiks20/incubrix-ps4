/**
 * Reads a destination ID and sends the matching resource.
 * Missing-record decisions stay in the service layer.
 */
const { getById } = require('../services/getById');
async function getByIdHandler(request, reply) { return reply.send(await getById(request.server.knex, request.params.id)); }
module.exports = getByIdHandler;
