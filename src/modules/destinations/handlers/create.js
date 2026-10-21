/**
 * Reads the creation body and sends the service result with HTTP 201.
 * Request validation and business rules are handled by schemas and services.
 */
const { create } = require('../services/create');
async function createHandler(request, reply) { return reply.code(201).send(await create(request.server.knex, request.body)); }
module.exports = createHandler;
