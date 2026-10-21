/**
 * Stores connector publish claims and platform results for recoverable publishing.
 * The unique key prevents one idempotency key from creating two remote posts.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('publish_ledger', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.text('connector_key').notNullable();
    table.text('idempotency_key').notNullable();
    table.text('destination_ref').notNullable();
    table.text('request_hash').notNullable();
    table.text('marker').notNullable();
    table.text('state').notNullable().checkIn(['in_flight', 'published', 'unknown', 'failed']);
    table.text('platform_post_id');
    table.text('live_url');
    table.text('error_code');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['connector_key', 'idempotency_key']);
  });
};

exports.down = async function down(knex) { await knex.schema.dropTableIfExists('publish_ledger'); };
