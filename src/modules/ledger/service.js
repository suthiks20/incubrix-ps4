/**
 * Coordinates idempotent platform publishing with the durable ledger.
 * Ambiguous failures are reconciled by marker before another remote create is attempted.
 */
const crypto = require('crypto');
const AppError = require('../../shared/errors/AppError');
const { requestHash } = require('../../shared/idempotency/hash');
const { assertValidKey } = require('../../shared/idempotency/keyValidation');
const repository = require('./repository');
const { destinationRef } = require('../connectors/commons/destinationRef');
const RETRY_ACTION = 'Retry with the same idempotency_key. The service will check the platform for the post before publishing again, so no duplicate is created.';

function withUnknownLedgerDetails(error) {
  if (error.code !== 'PLATFORM_UNAVAILABLE') return error;
  error.details = { ...error.details, ledger_state: 'unknown', action: RETRY_ACTION };
  return error;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function publish(knex, connector, rendition, destination, connection, key, config = {}) {
  assertValidKey(key);
  const normalized = destinationRef(destination);
  const hash = requestHash('POST', normalized, {}, rendition);
  const marker = crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
  const data = { connector_key: connector.key, idempotency_key: key, destination_ref: normalized, request_hash: hash, marker, state: 'in_flight' };
  let row = await repository.claim(knex, data);
  if (!row) {
    row = await repository.find(knex, connector.key, key);
    if (row.request_hash !== hash) throw new AppError('IDEMPOTENCY_KEY_CONFLICT', 'This idempotency key was already used for a different request', { statusCode: 409 });
    if (row.state === 'published') return { ...resultFromRow(row), replay: true };
    if (row.state === 'in_flight') {
      const age = Date.now() - new Date(row.updated_at).getTime();
      const lockMs = Number(config.IDEMPOTENCY_LOCK_TTL_SECONDS || 60) * 1000;
      if (age < lockMs) {
        const deadline = Date.now() + Number(config.IDEMPOTENCY_WAIT_MS || 5000);
        do {
          await delay(50);
          row = await repository.find(knex, connector.key, key);
          if (row.state === 'published') return { ...resultFromRow(row), replay: true };
        } while (row.state === 'in_flight' && Date.now() < deadline);
        if (row.state === 'in_flight') throw new AppError('IDEMPOTENCY_REQUEST_IN_PROGRESS', 'An identical publish request is still in progress', { statusCode: 409, retryable: true });
      }
    }
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
async function publishedTimes(knex, connectorKey, ref, since, states, excludeKey) { return repository.publishedTimes(knex, connectorKey, ref, since, states, excludeKey); }
async function find(knex, connectorKey, key) { return repository.find(knex, connectorKey, key); }
module.exports = { publish, publishedTimes, find };
