/**
 * Contains Knex queries for destination records and nothing else.
 * Services interpret duplicates, missing records, and request values.
 */
const { TABLE_NAME } = require('../commons/constants');

function filtersQuery(knex, filters) {
  let query = knex(TABLE_NAME);
  Object.entries(filters).forEach(([key, value]) => { query = query.where(key, value); });
  return query;
}

async function insert(knex, data) {
  const rows = await knex(TABLE_NAME).insert(data).returning('*');
  return rows[0];
}
function findAll(knex, filters, limit, offset) {
  return filtersQuery(knex, filters).select('*').orderBy('created_at', 'desc').orderBy('id', 'asc').limit(limit).offset(offset);
}
async function countAll(knex, filters) {
  const result = await filtersQuery(knex, filters).count({ total: '*' }).first();
  return Number(result.total);
}
function findById(knex, id) { return knex(TABLE_NAME).where({ id }).first(); }
async function findByPlatformAndUrl(knex, platformKey, urlNormalized) {
  return knex(TABLE_NAME).where({ platform_key: platformKey, url_normalized: urlNormalized }).first();
}
async function updateById(knex, id, data) {
  const rows = await knex(TABLE_NAME).where({ id }).update({ ...data, updated_at: knex.fn.now() }).returning('*');
  return rows[0];
}
function deleteById(knex, id) { return knex(TABLE_NAME).where({ id }).del(); }

module.exports = { insert, findAll, countAll, findById, findByPlatformAndUrl, updateById, deleteById };
