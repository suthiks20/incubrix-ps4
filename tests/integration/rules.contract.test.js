/**
 * Verifies publish-time destination rules against the in-process Discourse mock.
 * Each case uses PostgreSQL ledger state so policy effects are observable end to end.
 */
const buildApp = require('../../src/app');
const { createTestDatabase } = require('./testDatabase');
let app; let knex; let root;
const connection = { api_key: 'fake-api-key', api_username: 'fake-user' };
beforeAll(async () => { knex = createTestDatabase(); app = buildApp({ knex, apiToken: '' }); await app.listen({ port: 0, host: '127.0.0.1' }); root = `http://127.0.0.1:${app.server.address().port}/mock/discourse`; });
beforeEach(async () => { await knex('publish_ledger').del(); await fetch(`${root}/normal/_reset`, { method: 'POST' }); });
afterAll(async () => { await app.close(); await knex.destroy(); });
function request(key, destination = {}, rendition = {}) { return { idempotency_key: key, destination: { config: { base_url: `${root}/normal` }, ...destination }, connection, rendition: { title: 'A sufficiently long title', body: 'Helpful body', language: 'en', ...rendition } }; }
async function publish(body) { return app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: body }); }
test('HARD CASE second post inside the weekly cap is rescheduled with next_allowed_at', async () => {
  const destination = { frequency_cap: { posts: 1, per_days: 7 } }; expect((await publish(request('rule-cap-1', destination))).statusCode).toBe(200);
  const second = await publish(request('rule-cap-2', destination)); expect(second.statusCode).toBe(429); expect(second.json().error.code).toBe('DEST_RULE_FREQUENCY_CAP'); expect(new Date(second.json().error.details.next_allowed_at).getTime()).toBeGreaterThan(Date.now() + 6 * 86400000); expect((await fetch(`${root}/normal/_state`).then((r) => r.json())).posts).toHaveLength(1);
});
test('HARD CASE retrying a published key under a cap replays with 200 and Idempotent-Replay true', async () => {
  const body = request('rule-replay', { frequency_cap: { posts: 1, per_days: 7 } }); expect((await publish(body)).statusCode).toBe(200); const retry = await publish(body); expect(retry.statusCode).toBe(200); expect(retry.headers['idempotent-replay']).toBe('true');
});
test('HARD CASE promotional post to a no-promo destination is blocked', async () => {
  const response = await publish(request('rule-promo', { self_promo_allowed: false }, { is_promotional: true })); expect(response.statusCode).toBe(422); expect(response.json().error.code).toBe('DEST_RULE_VIOLATION'); expect((await fetch(`${root}/normal/_state`).then((r) => r.json())).post_attempts).toBe(0); expect(await knex('publish_ledger').where({ idempotency_key: 'rule-promo' })).toHaveLength(0);
});
test('HARD CASE AI disclosure is appended automatically', async () => {
  const response = await publish(request('rule-ai', { disclosure_required: true }, { ai_generated: true })); expect(response.statusCode).toBe(200); expect(response.json().warnings.map((x) => x.code)).toContain('AI_DISCLOSURE_APPENDED'); expect((await fetch(`${root}/normal/_state`).then((r) => r.json())).posts[0].raw).toContain('Disclosure: this post was created with AI assistance.');
});
test('HARD CASE non-English destination blocks an English post with LANGUAGE_MISMATCH', async () => { const r = await publish(request('rule-language', { language: 'hi' })); expect(r.statusCode).toBe(422); expect(r.json().error.details.reasons.map((x) => x.code)).toContain('LANGUAGE_MISMATCH'); });
test('automation_allowed false destination on a native connector returns assisted guidance', async () => { const r = await publish(request('rule-assist', { automation_allowed: false })); expect(r.statusCode).toBe(409); expect(r.json().error.code).toBe('DEST_RULE_VIOLATION'); expect(r.json().error.message).toMatch(/assisted connector/i); });
test('dry-run POST /api/v1/rules/evaluate returns decision and reasons', async () => { const r = await app.inject({ method: 'POST', url: '/api/v1/rules/evaluate', headers: { 'Idempotency-Key': 'rule-dry-run' }, payload: { rendition: { title: 'x', body: 'x', is_promotional: true }, destination: { self_promo_allowed: false, config: { base_url: `${root}/normal` } } } }); expect(r.statusCode).toBe(200); expect(r.json()).toMatchObject({ decision: 'block', reasons: expect.any(Array) }); });
