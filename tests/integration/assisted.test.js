/**
 * Confirms assisted packs stay local and unsupported automated actions are explicit.
 * The generated checklist translates destination policy into a human posting task.
 */
const buildApp = require('../../src/app'); const { createTestDatabase } = require('./testDatabase');
let app; let knex;
beforeAll(async () => { knex = createTestDatabase(); app = buildApp({ knex, apiToken: '' }); await app.ready(); }); afterAll(async () => { await app.close(); await knex.destroy(); });
const payload = { destination: { url: 'https://forum.test', config: { submit_url: 'https://forum.test/new', caption_max_chars: 30, rules_url: 'https://forum.test/rules' }, frequency_cap: { posts: 1, per_days: 7 }, self_promo_allowed: false, link_policy: 'no_links', disclosure_required: true, language: 'en' }, rendition: { title: 'Helpful title', body: 'This caption has several whole words for truncation', ai_generated: true, media: [{ name: 'image.png', url: 'https://image.test/a.png', type: 'image' }] } };
test('build_assist_pack returns files caption deep_link and generated checklist', async () => { const r = await app.inject({ method: 'POST', url: '/connector/v1/assisted/build_assist_pack', payload }); expect(r.statusCode).toBe(200); expect(r.json().files).toHaveLength(1); expect(r.json().caption.length).toBeLessThanOrEqual(30); expect(r.json().deep_link).toBe('https://forum.test/new'); expect(r.json().checklist.map((x) => x.item).join(' ')).toMatch(/Delete or report/); });
test('build_assist_pack makes no network call', async () => { const original = global.fetch; global.fetch = jest.fn(); try { const r = await app.inject({ method: 'POST', url: '/connector/v1/assisted/build_assist_pack', payload }); expect(r.statusCode).toBe(200); expect(global.fetch).not.toHaveBeenCalled(); } finally { global.fetch = original; } });
test('publish on assisted returns CONNECTOR_NOT_IMPLEMENTED', async () => { const r = await app.inject({ method: 'POST', url: '/connector/v1/assisted/publish', payload: { ...payload, idempotency_key: 'assist-publish' } }); expect(r.statusCode).toBe(501); expect(r.json().error.code).toBe('CONNECTOR_NOT_IMPLEMENTED'); });
test('build_assist_pack on discourse returns CONNECTOR_NOT_IMPLEMENTED', async () => { const r = await app.inject({ method: 'POST', url: '/connector/v1/discourse/build_assist_pack', payload }); expect(r.statusCode).toBe(501); });
