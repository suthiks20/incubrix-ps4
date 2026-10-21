/**
 * Proves same-key and cap-protected concurrent publishes do not duplicate posts.
 * The slow mock makes the fresh in-flight ledger claim observable to all callers.
 */
const buildApp = require('../../src/app'); const { createTestDatabase } = require('./testDatabase');
let app; let knex; let url;
beforeAll(async () => { knex = createTestDatabase(); app = buildApp({ knex, apiToken: '' }); await app.listen({ port: 0, host: '127.0.0.1' }); url = `http://127.0.0.1:${app.server.address().port}/mock/discourse/slow`; });
beforeEach(async () => { await knex('publish_ledger').del(); await fetch(`${url}/_reset`, { method: 'POST' }); }); afterAll(async () => { await app.close(); await knex.destroy(); });
function body(key) { return { idempotency_key: key, destination: { config: { base_url: url }, frequency_cap: { posts: 1, per_days: 7 } }, connection: { api_key: 'fake', api_username: 'fake' }, rendition: { title: 'A sufficiently long title', body: 'Body' } }; }
test('HARD CASE five simultaneous identical publishes create exactly one post and return identical results', async () => { const responses = await Promise.all(Array.from({ length: 5 }, () => app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: body('race-same') }))); expect(responses.map((r) => r.statusCode)).toEqual([200, 200, 200, 200, 200]); expect(new Set(responses.map((r) => r.json().platform_post_id)).size).toBe(1); expect((await fetch(`${url}/_state`).then((r) => r.json())).posts).toHaveLength(1); });
test('two simultaneous different-key publishes to a cap-one destination give one 200 and one 429', async () => { const responses = await Promise.all(['race-a', 'race-b'].map((key) => app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: body(key) }))); expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 429]); });
