/**
 * Exercises the signed webhook protocol with only the fixed local fake secret.
 * The mock verifies signatures and lets timeout recovery be checked against PostgreSQL.
 */
const buildApp = require('../../src/app');
const { createTestDatabase } = require('./testDatabase');
const { sign } = require('../../src/modules/connectors/webhook/sign');
let app; let knex; let root;
const secret = 'test-signing-secret';
beforeAll(async () => { knex = createTestDatabase(); app = buildApp({ knex, apiToken: '' }); await app.listen({ port: 0, host: '127.0.0.1' }); root = `http://127.0.0.1:${app.server.address().port}/mock/webhook`; });
beforeEach(async () => { await knex('publish_ledger').del(); await Promise.all(['normal', 'bad_signature', 'partner_revoked', 'timeout_after_success', 'renamed_field'].map((s) => fetch(`${root}/${s}/_reset`, { method: 'POST' }))); });
afterAll(async () => { await app.close(); await knex.destroy(); });
function payload(key, scenario = 'normal') { return { idempotency_key: key, destination_ref: `${root}/${scenario}`, connection: { signing_secret: secret }, rendition: { title: 'Webhook title', body: 'Webhook body', language: 'en' } }; }
async function post(body) { return app.inject({ method: 'POST', url: '/connector/v1/webhook/publish', payload: body }); }
test('signature verifies and invalid or stale signatures are rejected', async () => {
  expect((await post(payload('webhook-normal'))).statusCode).toBe(200); expect((await post(payload('webhook-bad', 'bad_signature'))).json().error.code).toBe('CONNECTION_AUTH_EXPIRED');
  const raw = JSON.stringify({ title: 'tampered' }); const timestamp = String(Math.floor(Date.now() / 1000));
  expect((await fetch(`${root}/normal/posts`, { method: 'POST', headers: { 'content-type': 'application/json', 'X-IncuBrix-Timestamp': timestamp, 'X-IncuBrix-Signature': sign(secret, timestamp, '{}') }, body: raw })).status).toBe(401);
  const stale = String(Math.floor(Date.now() / 1000) - 301); expect((await fetch(`${root}/normal/posts`, { method: 'POST', headers: { 'content-type': 'application/json', 'X-IncuBrix-Timestamp': stale, 'X-IncuBrix-Signature': sign(secret, stale, raw) }, body: raw })).status).toBe(401);
});
test('HARD CASE partner revokes permission returns CONNECTION_AUTH_EXPIRED', async () => { const r = await post(payload('webhook-revoked', 'partner_revoked')); expect(r.statusCode).toBe(401); expect(r.json().error.code).toBe('CONNECTION_AUTH_EXPIRED'); });
test('HARD CASE webhook timeout then retry creates exactly one post', async () => {
  const body = payload('webhook-timeout', 'timeout_after_success'); const first = await post(body); expect(first.statusCode).toBe(503); expect(first.json().error.details.ledger_state).toBe('unknown'); expect((await knex('publish_ledger').where({ idempotency_key: body.idempotency_key }).first()).state).toBe('unknown'); const retry = await post(body); expect(retry.statusCode).toBe(200); expect(retry.headers['idempotent-replay']).toBe('true'); expect((await fetch(`${root}/timeout_after_success/_state`).then((r) => r.json())).posts).toHaveLength(1);
});
test('HARD CASE webhook timeout retry under a frequency cap still reconciles', async () => {
  const body = payload('webhook-timeout-cap', 'timeout_after_success'); body.destination = { config: { base_url: `${root}/timeout_after_success` }, frequency_cap: { posts: 1, per_days: 7 } };
  expect((await post(body)).statusCode).toBe(503); const retry = await post(body); expect(retry.statusCode).toBe(200); expect(retry.headers['idempotent-replay']).toBe('true'); expect((await fetch(`${root}/timeout_after_success/_state`).then((r) => r.json())).posts).toHaveLength(1);
});
test('HARD CASE webhook renamed field returns SCHEMA_DRIFT', async () => { const r = await post(payload('webhook-schema', 'renamed_field')); expect(r.statusCode).toBe(502); expect(r.json().error.details.missing_fields).toContain('url'); });
test('get_status and delete round trip, delete twice is fine', async () => { const published = await post(payload('webhook-round')); const id = published.json().platform_post_id; const input = { destination_ref: `${root}/normal`, connection: { signing_secret: secret }, platform_post_id: id }; expect((await app.inject({ method: 'POST', url: '/connector/v1/webhook/get_status', payload: input })).json().status).toBe('published'); expect((await app.inject({ method: 'POST', url: '/connector/v1/webhook/delete', payload: input })).json()).toEqual({ deleted: true }); expect((await app.inject({ method: 'POST', url: '/connector/v1/webhook/delete', payload: input })).json()).toEqual({ deleted: true }); });
