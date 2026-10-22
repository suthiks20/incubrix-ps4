/**
 * Verifies local Discourse cleanup fault scenarios fail only their documented attempts.
 * These scenarios let WP1 test immediate cleanup and the janitor without external posts.
 */
const { createContext, reset, mockState } = require('./helpers');

let ctx;

beforeAll(async () => {
  ctx = await createContext();
});

beforeEach(async () => {
  await reset(ctx);
});

afterAll(async () => {
  await ctx.close();
});

test('delete_fails_once records one failed DELETE before succeeding', async () => {
  const url = `${ctx.mockRoot}/discourse/delete_fails_once/t/1.json`;
  expect((await fetch(url, { method: 'DELETE' })).status).toBe(503);
  expect((await fetch(url, { method: 'DELETE' })).status).toBe(200);
  expect((await mockState(ctx, 'discourse', 'delete_fails_once')).delete_attempts).toBe(2);
});

test('delete_fails_twice records two failed DELETEs before succeeding', async () => {
  const url = `${ctx.mockRoot}/discourse/delete_fails_twice/t/1.json`;
  expect((await fetch(url, { method: 'DELETE' })).status).toBe(503);
  expect((await fetch(url, { method: 'DELETE' })).status).toBe(503);
  expect((await fetch(url, { method: 'DELETE' })).status).toBe(200);
  expect((await mockState(ctx, 'discourse', 'delete_fails_twice')).delete_attempts).toBe(3);
});
