/**
 * Contains Knex-only persistence operations for certification run rows.
 * Filtered lists accept only the explicit public run filter fields.
 */
const { ALLOWED_RUN_FILTERS } = require('../commons/constants');

const TABLE = 'certification_runs';

async function insert(knex, row) {
  const rows = await knex(TABLE).insert(row).returning('*');
  return rows[0];
}

async function update(knex, id, values) {
  const rows = await knex(TABLE).where({ id }).update(values).returning('*');
  return rows[0];
}

function findById(knex, id) {
  return knex(TABLE).where({ id }).first();
}

function list(knex, filters = {}) {
  const entries = Object.entries(filters).filter(([key]) => ALLOWED_RUN_FILTERS.includes(key));
  const values = Object.fromEntries(entries);
  const limit = values.limit || 50;
  const offset = values.offset || 0;
  delete values.limit;
  delete values.offset;
  return knex(TABLE).where(values).orderBy('started_at', 'desc').limit(limit).offset(offset);
}

module.exports = { insert, update, findById, list, findAll: list };
