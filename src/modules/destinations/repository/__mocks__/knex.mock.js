/**
 * Implements the small Knex query-builder surface used by destination tests.
 * The in-memory rows make service tests deterministic and database-free.
 */
function createKnexMock(initialRows = []) {
  const rows = [...initialRows];
  let sequence = 1;
  class Query {
    constructor() { this.filters = {}; this.operation = 'select'; this.firstOnly = false; }
    where(key, value) {
      if (typeof key === 'object') Object.assign(this.filters, key);
      else this.filters[key] = value;
      return this;
    }
    insert(data) { this.operation = 'insert'; this.data = data; return this; }
    update(data) { this.operation = 'update'; this.data = data; return this; }
    del() { this.operation = 'delete'; return this.execute(); }
    returning() { return this; }
    select() { return this; }
    orderBy() { return this; }
    limit() { return this; }
    offset() { return this; }
    count() { this.operation = 'count'; return this; }
    first() { this.firstOnly = true; return this.execute().then((result) => Array.isArray(result) ? result[0] : result); }
    matches(row) { return Object.entries(this.filters).every(([key, value]) => row[key] === value); }
    async execute() {
      if (this.operation === 'insert') {
        const now = new Date();
        const row = { id: `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`, surface: 'default', audience_tags: [], language: 'en', self_promo_allowed: false, link_policy: 'allowed', disclosure_required: false, automation_allowed: true, config: {}, level: 'L0', enabled: true, demoted: false, created_at: now, updated_at: now, ...this.data };
        rows.push(row);
        return [row];
      }
      const selected = rows.filter((row) => this.matches(row));
      if (this.operation === 'update') { selected.forEach((row) => Object.assign(row, this.data)); return selected; }
      if (this.operation === 'delete') { selected.forEach((row) => rows.splice(rows.indexOf(row), 1)); return selected.length; }
      if (this.operation === 'count') return [{ total: selected.length }];
      return selected;
    }
    then(resolve, reject) { return this.execute().then(resolve, reject); }
  }
  const knex = () => new Query();
  knex.rows = rows;
  knex.fn = { now: () => new Date() };
  knex.raw = jest.fn().mockResolvedValue({});
  return knex;
}

module.exports = { createKnexMock };
