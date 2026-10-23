/**
 * Covers the Lemmy connector against its simulation-only API surface.
 * The tests exercise cached login, recovery, strict fields, and soft deletion.
 */
const buildApp = require('../../src/app');
const { createTestDatabase } = require('./testDatabase');

const scenarios = ['normal', 'timeout_after_success', 'renamed_field', 'rate_limit_long', 'rate_limit_short', 'expired_token', 'content_rejected'];
let app; let knex; let root;
function connection(password = 'lemmy-password') { return { api_username: 'lemmy-user', api_key: password }; }
function request(key, scenario = 'normal', extra = {}) { return { idempotency_key: key, destination_ref: `${root}/${scenario}`, connection: connection(extra.password), rendition: { title: extra.title || 'Lemmy post', body: extra.body || 'Lemmy body' } }; }
function error(response, status, code) { expect(response.statusCode).toBe(status); expect(response.json().error.code).toBe(code); }
async function state(scenario) { return fetch(`${root}/${scenario}/_state`).then((response) => response.json()); }
beforeAll(async () => { knex = createTestDatabase(); app = buildApp({ knex, apiToken: '' }); await app.listen({ port: 0, host: '127.0.0.1' }); root = `http://127.0.0.1:${app.server.address().port}/mock/lemmy`; });
beforeEach(async () => { await knex.raw('TRUNCATE publish_ledger, destinations, certification_runs, destination_alerts CASCADE'); await Promise.all(scenarios.map((scenario) => fetch(`${root}/${scenario}/_reset`, { method: 'POST' }))); });
afterAll(async () => { await app.close(); await knex.destroy(); });

test('lemmy logs in once and reuses the cached token', async () => { expect((await app.inject({ method: 'POST', url: '/connector/v1/lemmy/publish', payload: request('lemmy-login-1') })).statusCode).toBe(200); expect((await app.inject({ method: 'POST', url: '/connector/v1/lemmy/publish', payload: request('lemmy-login-2') })).statusCode).toBe(200); expect((await state('normal')).logins).toBe(1); });
test('lemmy refused login returns CONNECTION_AUTH_EXPIRED', async () => { error(await app.inject({ method: 'POST', url: '/connector/v1/lemmy/publish', payload: request('lemmy-login-bad', 'normal', { password: 'wrong' }) }), 401, 'CONNECTION_AUTH_EXPIRED'); });
test('lemmy resolves the community before publishing', async () => { const response = await app.inject({ method: 'POST', url: '/connector/v1/lemmy/publish', payload: request('lemmy-community-1') }); expect(response.json().platform_post_id).toBe('1'); });
test('lemmy delete is confirmed by get_status', async () => { const published = await app.inject({ method: 'POST', url: '/connector/v1/lemmy/publish', payload: request('lemmy-delete-1') }); const shared = { destination_ref: `${root}/normal`, connection: connection(), platform_post_id: published.json().platform_post_id }; expect((await app.inject({ method: 'POST', url: '/connector/v1/lemmy/delete', payload: shared })).json()).toEqual({ deleted: true }); expect((await app.inject({ method: 'POST', url: '/connector/v1/lemmy/get_status', payload: shared })).json()).toEqual({ status: 'deleted', live_url: null }); });
test('HARD CASE lemmy renamed field returns SCHEMA_DRIFT', async () => { const response = await app.inject({ method: 'POST', url: '/connector/v1/lemmy/publish', payload: request('lemmy-rename-1', 'renamed_field') }); error(response, 502, 'SCHEMA_DRIFT'); });
test('lemmy 429 reset time returns PLATFORM_RATE_LIMIT', async () => { const response = await app.inject({ method: 'POST', url: '/connector/v1/lemmy/publish', payload: request('lemmy-rate-long', 'rate_limit_long') }); error(response, 429, 'PLATFORM_RATE_LIMIT'); expect(response.json().error.details.retry_after_seconds).toBeGreaterThan(100); });
test('lemmy short reset is retried once', async () => { const response = await app.inject({ method: 'POST', url: '/connector/v1/lemmy/publish', payload: request('lemmy-rate-short', 'rate_limit_short') }); expect(response.statusCode).toBe(200); expect((await state('rate_limit_short')).post_attempts).toBe(2); });
test('lemmy expired login never creates a post', async () => { error(await app.inject({ method: 'POST', url: '/connector/v1/lemmy/publish', payload: request('lemmy-expired-1', 'expired_token') }), 401, 'CONNECTION_AUTH_EXPIRED'); expect((await state('expired_token')).post_attempts).toBe(0); });
test('lemmy content rejection maps to PLATFORM_CONTENT_REJECTED', async () => { error(await app.inject({ method: 'POST', url: '/connector/v1/lemmy/publish', payload: request('lemmy-reject-1', 'content_rejected') }), 422, 'PLATFORM_CONTENT_REJECTED'); });
test('HARD CASE lemmy timeout retry reconciles one remote post', async () => { const payload = request('lemmy-timeout-1', 'timeout_after_success'); error(await app.inject({ method: 'POST', url: '/connector/v1/lemmy/publish', payload }), 503, 'PLATFORM_UNAVAILABLE'); const retry = await app.inject({ method: 'POST', url: '/connector/v1/lemmy/publish', payload }); expect(retry.statusCode).toBe(200); expect(retry.headers['idempotent-replay']).toBe('true'); expect((await state('timeout_after_success')).posts).toHaveLength(1); });
test('lemmy marker is stored in the published post body', async () => { await app.inject({ method: 'POST', url: '/connector/v1/lemmy/publish', payload: request('lemmy-marker-1') }); expect((await state('normal')).posts[0].body).toMatch(/ix_ref:/); });
test('lemmy validate accepts the documented post shape', async () => { const response = await app.inject({ method: 'POST', url: '/connector/v1/lemmy/validate', payload: { rendition: { title: 'Title', body: 'Body' } } }); expect(response.json()).toEqual({ ok: true, violations: [] }); });
