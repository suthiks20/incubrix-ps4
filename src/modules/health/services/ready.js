/**
 * Implements readiness by checking that PostgreSQL accepts a simple query.
 * Database details stay private while callers receive a stable AppError.
 */
const AppError = require('../../../shared/errors/AppError');
const { pingDb } = require('../repository/health');
async function getReady(knex, storage) {
  const checks = { db: 'ok', storage: 'ok' };
  try {
    await pingDb(knex);
  } catch { checks.db = 'down'; }
  try {
    await storage.ready();
  } catch { checks.storage = 'down'; }
  if (checks.db === 'ok' && checks.storage === 'ok') return { status: 'ready', checks };
  throw new AppError('NOT_READY', 'Service is not ready', {
    statusCode: 503,
    retryable: true,
    details: { checks }
  });
}
module.exports = { getReady };
