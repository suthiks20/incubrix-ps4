/**
 * Implements readiness by checking that PostgreSQL accepts a simple query.
 * Database details stay private while callers receive a stable AppError.
 */
const AppError = require('../../../shared/errors/AppError');
const { pingDb } = require('../repository/health');
async function getReady(knex) {
  try {
    await pingDb(knex);
    return { status: 'ready', checks: { db: 'ok' } };
  } catch {
    throw new AppError('NOT_READY', 'Service is not ready', { statusCode: 503, details: { checks: { db: 'down' } } });
  }
}
module.exports = { getReady };
