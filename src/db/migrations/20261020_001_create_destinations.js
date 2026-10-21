/**
 * Creates the destination catalogue and its lookup constraints and indexes.
 * Each destination stores public platform configuration, never credentials.
 */
const { TABLE_NAME } = require('../../modules/destinations/commons/constants');

exports.up = async function up(knex) {
  await knex.schema.createTable(TABLE_NAME, (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.text('name').notNullable();
    table.text('url').notNullable();
    table.text('url_normalized').notNullable();
    table.text('platform_key').notNullable();
    table.text('surface').notNullable().defaultTo('default');
    table.text('category');
    table.jsonb('audience_tags').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    table.text('language').notNullable().defaultTo('en');
    table.text('geo');
    table.integer('est_audience');
    table.text('rules_url');
    table.jsonb('frequency_cap');
    table.boolean('self_promo_allowed').notNullable().defaultTo(false);
    table.text('link_policy').notNullable().defaultTo('allowed');
    table.boolean('disclosure_required').notNullable().defaultTo(false);
    table.boolean('automation_allowed').notNullable().defaultTo(true);
    table.text('connector_key').notNullable();
    table.jsonb('config').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    table.text('connection_ref');
    table.integer('relevance_score').checkBetween([1, 5]);
    table.text('relevance_reason');
    table.text('level').notNullable().defaultTo('L0').checkIn(['L0', 'L1', 'L2', 'L3', 'L4']);
    table.timestamp('last_certified_at', { useTz: true });
    table.boolean('enabled').notNullable().defaultTo(true);
    table.boolean('demoted').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['platform_key', 'url_normalized'], { indexName: 'destinations_platform_url_unique' });
    table.index(['connector_key'], 'destinations_connector_key_idx');
    table.index(['level'], 'destinations_level_idx');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists(TABLE_NAME);
};
