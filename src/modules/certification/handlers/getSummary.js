/**
 * Returns durable connector-level certification metrics through the summary service.
 * The route has no persistence logic and remains a thin HTTP adapter.
 */
const { getSummary } = require('../services/summary');

async function getSummaryHandler(request) {
  return getSummary({ knex: request.server.knex, now: request.server.now });
}

module.exports = getSummaryHandler;
