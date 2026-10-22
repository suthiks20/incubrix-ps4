/**
 * Contains Knex-only persistence operations for certification alerts.
 * Alert services interpret unknown records and response behavior.
 */
const TABLE = 'destination_alerts';

async function insert(knex, row) {
  const rows = await knex(TABLE).insert(row).returning('*');
  return rows[0];
}

function findAll(knex, filters) {
  return knex(TABLE).where(filters).orderBy('created_at', 'desc');
}

function findById(knex, id) {
  return knex(TABLE).where({ id }).first();
}

async function acknowledge(knex, id) {
  const rows = await knex(TABLE)
    .where({ id })
    .update({ acknowledged: true, acknowledged_at: knex.fn.now() })
    .returning('*');
  return rows[0];
}

module.exports = { insert, findAll, findById, acknowledge };
