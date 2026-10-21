/**
 * Contains Knex-only certification run persistence queries.
 * Services own certification decisions and evidence construction.
 */
const TABLE = 'certification_runs';
async function insert(knex, row) { return (await knex(TABLE).insert(row).returning('*'))[0]; }
async function update(knex, id, values) { return (await knex(TABLE).where({ id }).update(values).returning('*'))[0]; }
function findById(knex, id) { return knex(TABLE).where({ id }).first(); }
function findAll(knex, filters) { return knex(TABLE).where(filters).orderBy('started_at', 'desc'); }
module.exports = { insert, update, findById, findAll };
