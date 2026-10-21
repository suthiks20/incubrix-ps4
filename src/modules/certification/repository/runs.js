/**
 * Contains Knex-only persistence operations for certification run rows.
 * Filtered lists accept only the explicit public run filter fields.
 */
const { ALLOWED_RUN_FILTERS } = require('../commons/constants');
const TABLE = 'certification_runs';
async function insert(knex, row) { const rows = await knex(TABLE).insert(row).returning('*'); return rows[0]; }
async function update(knex, id, values) { const rows = await knex(TABLE).where({ id }).update(values).returning('*'); return rows[0]; }
function findById(knex, id) { return knex(TABLE).where({ id }).first(); }
function list(knex, filters = {}) { const safe = Object.fromEntries(Object.entries(filters).filter(([key]) => ALLOWED_RUN_FILTERS.includes(key))); return knex(TABLE).where(safe).orderBy('started_at', 'desc'); }
module.exports = { insert, update, findById, list, findAll: list };
