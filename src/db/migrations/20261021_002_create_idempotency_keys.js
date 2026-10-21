/**
 * Stores request claims and completed responses so duplicate POSTs can replay safely.
 * The composite key scopes each client key to one method and path.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('idempotency_keys', (table) => {
    table.text('key').notNullable();
    table.text('method').notNullable();
    table.text('path').notNullable();
    table.text('request_hash').notNullable();
    table.text('state').notNullable().checkIn(['in_progress', 'completed']);
    table.integer('response_status').nullable();
    table.jsonb('response_body').nullable();
    table.text('response_content_type').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.primary(['key', 'method', 'path']);
    table.index(['expires_at'], 'idempotency_keys_expires_at_index');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('idempotency_keys');
};
