/**
 * Adapts the liveness service to a Fastify request handler.
 * It deliberately does not inspect the request or touch the database.
 */
const { getHealth } = require('../services/health');
async function healthHandler(_request, reply) { return reply.send(getHealth()); }
module.exports = healthHandler;
