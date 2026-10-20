/**
 * Uses a caller correlation ID or lets Fastify generate one per request.
 * The same value is returned in headers and bound to request log records.
 */
async function correlationId(app) {
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Correlation-Id', request.id);
  });
}

module.exports = correlationId;
