/**
 * Contains Knex-only operations for the publish ledger.
 * Publishing policy and recovery decisions belong in the service layer.
 */
const TABLE = 'publish_ledger';
async function claim(knex, data) { const rows = await knex(TABLE).insert(data).onConflict(['connector_key', 'idempotency_key']).ignore().returning('*'); return rows[0] || null; }
function find(knex, connectorKey, key) { return knex(TABLE).where({ connector_key: connectorKey, idempotency_key: key }).first(); }
async function publishedTimes(knex, connectorKey, destinationRef, since, states = ['published'], excludeKey) {
  let query = knex(TABLE).select('updated_at').where({ connector_key: connectorKey, destination_ref: destinationRef }).whereIn('state', states).where('updated_at', '>=', since);
  if (excludeKey) query = query.whereNot('idempotency_key', excludeKey);
  const rows = await query.orderBy('updated_at', 'asc');
  return rows.map((row) => new Date(row.updated_at).toISOString());
}
async function update(knex, connectorKey, key, values) { const rows = await knex(TABLE).where({ connector_key: connectorKey, idempotency_key: key }).update({ ...values, updated_at: knex.fn.now() }).returning('*'); return rows[0]; }
module.exports = { claim, find, update, publishedTimes };
