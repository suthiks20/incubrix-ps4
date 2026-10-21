/**
 * Lists destinations with validated filters and bounded pagination.
 * The repository handles query composition and stable ordering.
 */
const repository = require('../repository/destinations');
const { DEFAULT_PAGE_SIZE } = require('../commons/constants');

async function getAll(knex, query) {
  const { limit = DEFAULT_PAGE_SIZE, offset = 0, ...filters } = query;
  const [items, total] = await Promise.all([
    repository.findAll(knex, filters, limit, offset),
    repository.countAll(knex, filters)
  ]);
  return { items, total, limit, offset };
}

module.exports = { getAll };
