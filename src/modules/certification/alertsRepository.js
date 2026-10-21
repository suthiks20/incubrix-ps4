/**
 * Contains Knex-only queries for destination certification alerts.
 * Alert interpretation and HTTP behavior belong in the alerts service.
 */
const TABLE = 'destination_alerts';
async function insert(knex, row) { return (await knex(TABLE).insert(row).returning('*'))[0]; }
function findAll(knex, filters) { return knex(TABLE).where(filters).orderBy('created_at', 'desc'); }
function findById(knex, id) { return knex(TABLE).where({ id }).first(); }
async function acknowledge(knex, id) { return (await knex(TABLE).where({ id }).update({ acknowledged: true }).returning('*'))[0]; }
module.exports = { insert, findAll, findById, acknowledge };
