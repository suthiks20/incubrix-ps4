/**
 * Reads list filters and pagination from the validated query string.
 * The service returns the page and total count for the response.
 */
const { getAll } = require('../services/getAll');
async function getAllHandler(request, reply) { return reply.send(await getAll(request.server.knex, request.query)); }
module.exports = getAllHandler;
