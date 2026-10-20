/**
 * Contains the health module's only database operation.
 * Keeping it here makes readiness checks simple to mock and replace.
 */
async function pingDb(knex) { await knex.raw('select 1'); }
module.exports = { pingDb };
