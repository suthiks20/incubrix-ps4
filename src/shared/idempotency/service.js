/**
 * Coordinates ownership, waiting, replay, and cleanup for idempotent requests.
 * The repository remains responsible only for individual Knex operations.
 */
const AppError = require('../errors/AppError');
const repository = require('./repository');
const { setTimeout } = require('timers');

function conflictError() {
  return new AppError('IDEMPOTENCY_KEY_CONFLICT', 'This idempotency key was already used with a different request', { statusCode: 409 });
}

function inProgressError(waitMs) {
  return new AppError('IDEMPOTENCY_REQUEST_IN_PROGRESS', 'A request with this idempotency key is still in progress', {
    statusCode: 409, retryable: true, details: { retry_after_ms: waitMs }
  });
}

function isExpired(row) {
  return new Date(row.expires_at).getTime() < Date.now();
}

function isStale(row, lockTtlSeconds) {
  return row.state === 'in_progress' && new Date(row.updated_at).getTime() < Date.now() - lockTtlSeconds * 1000;
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function begin(knex, config, request) {
  const identity = { key: request.key, method: request.method, path: request.path };
  const lockTtl = config.IDEMPOTENCY_LOCK_TTL_SECONDS;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const expiresAt = new Date(Date.now() + config.IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000);
    const inserted = await repository.claim(knex, { ...identity, requestHash: request.requestHash, expiresAt });
    if (inserted) return { action: 'proceed' };

    let row = await repository.find(knex, identity.key, identity.method, identity.path);
    if (!row) continue;
    if (isExpired(row) || isStale(row, lockTtl)) {
      await repository.deleteIfStale(knex, identity.key, identity.method, identity.path, lockTtl, new Date());
      continue;
    }
    if (row.request_hash !== request.requestHash) throw conflictError();
    if (row.state === 'completed') return { action: 'replay', row };

    const deadline = Date.now() + config.IDEMPOTENCY_WAIT_MS;
    while (Date.now() < deadline) {
      await pause(Math.min(50, deadline - Date.now()));
      row = await repository.find(knex, identity.key, identity.method, identity.path);
      if (!row) break;
      if (isExpired(row) || isStale(row, lockTtl)) {
        await repository.deleteIfStale(knex, identity.key, identity.method, identity.path, lockTtl, new Date());
        row = null;
        break;
      }
      if (row.request_hash !== request.requestHash) throw conflictError();
      if (row.state === 'completed') return { action: 'replay', row };
    }
    if (!row) continue;
    throw inProgressError(config.IDEMPOTENCY_WAIT_MS);
  }
  throw inProgressError(config.IDEMPOTENCY_WAIT_MS);
}

async function finish(knex, context, { statusCode, body, contentType }) {
  if (statusCode >= 500) {
    await repository.release(knex, context.key, context.method, context.path);
    return;
  }
  await repository.complete(knex, context.key, context.method, context.path, {
    status: statusCode, body, contentType
  });
}

module.exports = { begin, finish };
