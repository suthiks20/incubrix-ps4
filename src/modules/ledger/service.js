/**
 * Coordinates idempotent platform publishing with the durable ledger.
 * Ambiguous failures are reconciled by marker before another remote create is attempted.
 */
const crypto = require('crypto');
const AppError = require('../../shared/errors/AppError');
const { requestHash } = require('../../shared/idempotency/hash');
const { assertValidKey } = require('../../shared/idempotency/keyValidation');
const repository = require('./repository');
const RETRY_ACTION = 'Retry with the same idempotency_key. The service will check the platform for the post before publishing again, so no duplicate is created.';

function withUnknownLedgerDetails(error) {
  if (error.code !== 'PLATFORM_UNAVAILABLE') return error;
  error.details = { ...error.details, ledger_state: 'unknown', action: RETRY_ACTION };
  return error;
}

async function publish(knex, connector, rendition, destination, connection, key) {
  assertValidKey(key);
  const normalized = destination.config.base_url.replace(/\/$/, '').toLowerCase();
  const hash = requestHash('POST', normalized, {}, rendition);
  const marker = crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
  const data = { connector_key: connector.key, idempotency_key: key, destination_ref: normalized, request_hash: hash, marker, state: 'in_flight' };
  let row = await repository.claim(knex, data);
  if (!row) {
    row = await repository.find(knex, connector.key, key);
    if (row.request_hash !== hash) throw new AppError('IDEMPOTENCY_KEY_CONFLICT', 'This idempotency key was already used for a different request', { statusCode: 409 });
    if (row.state === 'published') return { ...resultFromRow(row), replay: true };
    if (row.state === 'in_flight' || row.state === 'unknown') {
      let found;
      try { found = await connector.findByMarker(destination, connection, marker); }
      catch (error) { throw withUnknownLedgerDetails(error); }
      if (found) {
        row = await repository.update(knex, connector.key, key, { state: 'published', platform_post_id: found.platform_post_id, live_url: found.live_url, error_code: null });
        return { ...resultFromRow(row), replay: true };
      }
    }
    row = await repository.update(knex, connector.key, key, { state: 'in_flight', error_code: null });
  }
  try {
    const result = await connector.publish(rendition, destination, connection, key);
    row = await repository.update(knex, connector.key, key, { state: 'published', platform_post_id: result.platform_post_id, live_url: result.live_url, error_code: null });
    return { ...resultFromRow(row), replay: false };
  } catch (error) {
    await repository.update(knex, connector.key, key, { state: error.code === 'PLATFORM_UNAVAILABLE' ? 'unknown' : 'failed', error_code: error.code || 'INTERNAL_ERROR' });
    throw withUnknownLedgerDetails(error);
  }
}
function resultFromRow(row) { return { platform_post_id: row.platform_post_id, live_url: row.live_url, status: 'published' }; }
module.exports = { publish };
