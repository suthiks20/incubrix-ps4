/**
 * Adapts the readiness service to Fastify and passes the decorated Knex client.
 * The service owns database failure interpretation, not this handler.
 */
const { getReady } = require('../services/ready');
async function readyHandler(request, reply) { return reply.send(await getReady(request.server.knex, request.server.storage)); }
module.exports = readyHandler;
