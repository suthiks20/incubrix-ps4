/**
 * Adds the acknowledgement timestamp required by the certification alerts API.
 * Existing alert rows remain valid and simply have no acknowledgement time.
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('destination_alerts', (table) => {
    table.timestamp('acknowledged_at', { useTz: true });
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('destination_alerts', (table) => {
    table.dropColumn('acknowledged_at');
  });
};
