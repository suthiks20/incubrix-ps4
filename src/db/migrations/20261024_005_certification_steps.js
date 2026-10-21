/**
 * Adds durable certification step records to each run.
 * Stored steps let later reads return the exact completed certification sequence.
 */
exports.up = async function up(knex) { await knex.schema.alterTable('certification_runs', (table) => table.jsonb('steps').notNullable().defaultTo('[]')); };
exports.down = async function down(knex) { await knex.schema.alterTable('certification_runs', (table) => table.dropColumn('steps')); };
