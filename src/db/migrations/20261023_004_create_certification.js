/**
 * Persists certification outcomes, cleanup deadlines, evidence pointers, and alerts.
 * Separate rows preserve a durable audit trail without exposing connection secrets.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('certification_runs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()')); table.uuid('destination_id').notNullable().references('id').inTable('destinations').onDelete('CASCADE'); table.text('connector_key').notNullable(); table.text('status').notNullable().checkIn(['passed', 'failed', 'cleanup_pending']); table.text('level_awarded'); table.text('failure_code'); table.text('failure_step'); table.text('failure_message'); table.text('platform_post_id'); table.text('live_url'); table.boolean('test_post_deleted').notNullable().defaultTo(false); table.timestamp('cleanup_due_at', { useTz: true }); table.timestamp('cleaned_at', { useTz: true }); table.text('evidence_key'); table.timestamp('started_at', { useTz: true }).notNullable(); table.timestamp('finished_at', { useTz: true }); table.integer('duration_ms'); table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index('destination_id'); table.index(['status', 'cleanup_due_at']);
  });
  await knex.schema.createTable('destination_alerts', (table) => { table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()')); table.uuid('destination_id').notNullable().references('id').inTable('destinations').onDelete('CASCADE'); table.text('kind').notNullable(); table.text('message').notNullable(); table.uuid('run_id'); table.jsonb('details').notNullable().defaultTo('{}'); table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now()); table.boolean('acknowledged').notNullable().defaultTo(false); });
};
exports.down = async function down(knex) { await knex.schema.dropTableIfExists('destination_alerts'); await knex.schema.dropTableIfExists('certification_runs'); };
