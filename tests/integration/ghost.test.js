/**
 * Covers Ghost Admin JWT authentication, marker slugs, and deletion semantics.
 * Every platform call is handled by the local simulation-only Ghost mock.
 */
const buildApp = require('../../src/app');
const { createTestDatabase } = require('./testDatabase');
const key = 'fake-ghost-id:00112233445566778899aabbccddeeff';
const scenarios = ['normal', 'timeout_after_success', 'renamed_field', 'rate_limit_long', 'rate_limit_short', 'content_rejected'];
let app; let knex; let root;
function request(idempotencyKey, scenario = 'normal', apiKey = key) { return { idempotency_key: idempotencyKey, destination_ref: `${root}/${scenario}`, connection: { api_key: apiKey }, rendition: { title: 'Ghost post', body: 'Line one\n\nLine two' } }; }
function error(response, status, code) { expect(response.statusCode).toBe(status); expect(response.json().error.code).toBe(code); }
async function state(scenario) { return fetch(`${root}/${scenario}/_state`).then((response) => response.json()); }
beforeAll(async () => { knex = createTestDatabase(); app = buildApp({ knex, apiToken: '' }); await app.listen({ port: 0, host: '127.0.0.1' }); root = `http://127.0.0.1:${app.server.address().port}/mock/ghost`; });
beforeEach(async () => { await knex.raw('TRUNCATE publish_ledger, destinations, certification_runs, destination_alerts CASCADE'); await Promise.all(scenarios.map((scenario) => fetch(`${root}/${scenario}/_reset`, { method: 'POST' }))); });
afterAll(async () => { await app.close(); await knex.destroy(); });

test('ghost publishes with a signed Admin API JWT', async () => { const response = await app.inject({ method: 'POST', url: '/connector/v1/ghost/publish', payload: request('ghost-publish-1') }); expect(response.statusCode).toBe(200); });
test('ghost malformed key returns CONNECTION_AUTH_EXPIRED with no platform call', async () => { error(await app.inject({ method: 'POST', url: '/connector/v1/ghost/publish', payload: request('ghost-bad-key', 'normal', 'not-a-key') }), 401, 'CONNECTION_AUTH_EXPIRED'); expect((await state('normal')).post_attempts).toBe(0); });
test('ghost converts plaintext body to HTML', async () => { await app.inject({ method: 'POST', url: '/connector/v1/ghost/publish', payload: request('ghost-html-1') }); expect((await state('normal')).posts[0].html).toContain('<p>Line one</p><p>Line two</p>'); });
test('ghost marker is used as the post slug', async () => { await app.inject({ method: 'POST', url: '/connector/v1/ghost/publish', payload: request('ghost-slug-1') }); expect((await state('normal')).posts[0].slug).toMatch(/^ix-[a-f0-9]{16}$/); });
test('ghost delete is confirmed by get_status', async () => { const published = await app.inject({ method: 'POST', url: '/connector/v1/ghost/publish', payload: request('ghost-delete-1') }); const shared = { destination_ref: `${root}/normal`, connection: { api_key: key }, platform_post_id: published.json().platform_post_id }; expect((await app.inject({ method: 'POST', url: '/connector/v1/ghost/delete', payload: shared })).json()).toEqual({ deleted: true }); expect((await app.inject({ method: 'POST', url: '/connector/v1/ghost/get_status', payload: shared })).json()).toEqual({ status: 'deleted', live_url: null }); });
test('HARD CASE ghost renamed field returns SCHEMA_DRIFT', async () => { error(await app.inject({ method: 'POST', url: '/connector/v1/ghost/publish', payload: request('ghost-rename-1', 'renamed_field') }), 502, 'SCHEMA_DRIFT'); });
test('ghost 429 reset time returns PLATFORM_RATE_LIMIT', async () => { const response = await app.inject({ method: 'POST', url: '/connector/v1/ghost/publish', payload: request('ghost-rate-long', 'rate_limit_long') }); error(response, 429, 'PLATFORM_RATE_LIMIT'); expect(response.json().error.details.retry_after_seconds).toBeGreaterThan(100); });
test('ghost short reset is retried once', async () => { expect((await app.inject({ method: 'POST', url: '/connector/v1/ghost/publish', payload: request('ghost-rate-short', 'rate_limit_short') })).statusCode).toBe(200); expect((await state('rate_limit_short')).post_attempts).toBe(2); });
test('ghost content rejection maps to PLATFORM_CONTENT_REJECTED', async () => { error(await app.inject({ method: 'POST', url: '/connector/v1/ghost/publish', payload: request('ghost-reject-1', 'content_rejected') }), 422, 'PLATFORM_CONTENT_REJECTED'); });
test('HARD CASE ghost timeout retry reconciles one remote post', async () => { const payload = request('ghost-timeout-1', 'timeout_after_success'); error(await app.inject({ method: 'POST', url: '/connector/v1/ghost/publish', payload }), 503, 'PLATFORM_UNAVAILABLE'); const retry = await app.inject({ method: 'POST', url: '/connector/v1/ghost/publish', payload }); expect(retry.statusCode).toBe(200); expect(retry.headers['idempotent-replay']).toBe('true'); expect((await state('timeout_after_success')).posts).toHaveLength(1); });
test('ghost findByMarker uses the marker-derived slug', async () => { await app.inject({ method: 'POST', url: '/connector/v1/ghost/publish', payload: request('ghost-find-1') }); const retry = await app.inject({ method: 'POST', url: '/connector/v1/ghost/publish', payload: request('ghost-find-1') }); expect(retry.headers['idempotent-replay']).toBe('true'); });
test('ghost validate accepts the documented post shape', async () => { const response = await app.inject({ method: 'POST', url: '/connector/v1/ghost/validate', payload: { rendition: { title: 'Title', body: 'Body' } } }); expect(response.json()).toEqual({ ok: true, violations: [] }); });
