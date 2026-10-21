/**
 * Contains Knex queries for idempotency claims and stored responses only.
 * Decision making and retry timing stay in service.js.
 */
async function claim(knex, { key, method, path, requestHash, expiresAt }) {
  const rows = await knex('idempotency_keys').insert({
    key, method, path, request_hash: requestHash, state: 'in_progress', expires_at: expiresAt
  }).onConflict(['key', 'method', 'path']).ignore().returning('*');
  return rows[0] || null;
}

function find(knex, key, method, path) {
  return knex('idempotency_keys').where({ key, method, path }).first();
}

async function complete(knex, key, method, path, { status, body, contentType }) {
  return knex('idempotency_keys').where({ key, method, path }).update({
    state: 'completed', response_status: status, response_body: body,
    response_content_type: contentType, updated_at: knex.fn.now()
  });
}

async function release(knex, key, method, path) {
  return knex('idempotency_keys').where({ key, method, path }).delete();
}

async function deleteIfStale(knex, key, method, path, lockTtlSeconds, now = new Date()) {
  const staleBefore = new Date(now.getTime() - lockTtlSeconds * 1000);
  const deleted = await knex('idempotency_keys').where({ key, method, path }).where((query) => {
    query.where((stale) => stale.where('state', 'in_progress').where('updated_at', '<', staleBefore))
      .orWhere('expires_at', '<', now);
  }).delete();
  return deleted > 0;
}

async function purgeExpired(knex) {
  return knex('idempotency_keys').where('expires_at', '<', knex.fn.now()).delete();
}

module.exports = { claim, find, complete, release, deleteIfStale, purgeExpired };
