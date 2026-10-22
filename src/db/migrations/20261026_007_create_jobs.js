/**
 * Creates durable background jobs and their compact callback delivery state.
 * Job inputs and results remain JSON so type handlers can evolve independently.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.text('type').notNullable();
    table.text('status').notNullable().checkIn(['queued', 'running', 'succeeded', 'failed']);
    table.integer('progress').notNullable().defaultTo(0);
    table.jsonb('input').notNullable();
    table.jsonb('result');
    table.jsonb('error');
    table.text('callback_url');
    table.text('callback_status').checkIn(['delivered', 'failed']);
    table.text('correlation_id');
    table.integer('attempts').notNullable().defaultTo(0);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('started_at', { useTz: true });
    table.timestamp('finished_at', { useTz: true });
    table.index(['status', 'created_at']);
  });
};
exports.down = async function down(knex) { await knex.schema.dropTableIfExists('jobs'); };
