/**
 * Verifies migrations are repeatable and create the destination uniqueness index.
 * The checks run only against the isolated Jest database.
 */
const { runMigrations } = require('../../src/db/migrate');
const { createTestDatabase } = require('./testDatabase');
let knex;
beforeAll(() => { knex = createTestDatabase(); });
afterAll(async () => { await knex.destroy(); });
test('running migrations twice is safe and creates the unique index', async () => {
  await expect(runMigrations(knex, { info: () => {} })).resolves.toBeDefined();
  await expect(runMigrations(knex, { info: () => {} })).resolves.toBeDefined();
  const result = await knex.raw("SELECT indexdef FROM pg_indexes WHERE tablename = 'destinations' AND indexname = 'destinations_platform_url_unique'");
  expect(result.rows[0].indexdef).toContain('(platform_key, url_normalized)');
  const idempotency = await knex.raw("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'idempotency_keys'::regclass AND contype = 'p'");
  expect(idempotency.rows[0].definition).toContain('PRIMARY KEY (key, method, path)');
});
