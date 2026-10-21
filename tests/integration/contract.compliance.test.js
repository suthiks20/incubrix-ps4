/**
 * Checks contract methods that must not require a publish idempotency key.
 * Catalogue assertions ensure all manifest-backed connectors are discoverable.
 */
const buildApp = require('../../src/app'); const { createTestDatabase } = require('./testDatabase');
let app; let knex; let base;
beforeAll(async () => { knex = createTestDatabase(); app = buildApp({ knex, apiToken: '' }); await app.listen({ port: 0, host: '127.0.0.1' }); base = `http://127.0.0.1:${app.server.address().port}/mock/discourse/normal`; });
afterAll(async () => { await app.close(); await knex.destroy(); });
test('validate and get_status work without idempotency_key and validate returns ok', async () => { const valid = await app.inject({ method: 'POST', url: '/connector/v1/discourse/validate', payload: { rendition: { title: 'Good title', body: 'Good body' } } }); expect(valid.json()).toEqual({ ok: true, violations: [] }); const status = await app.inject({ method: 'POST', url: '/connector/v1/discourse/get_status', payload: { destination_ref: base, connection: { api_key: 'fake', api_username: 'fake' }, platform_post_id: 'missing' } }); expect(status.statusCode).toBe(200); expect(status.json().status).toBe('deleted'); });
test('get_status with no destination or base_url returns validation error', async () => { const r = await app.inject({ method: 'POST', url: '/connector/v1/discourse/get_status', payload: { platform_post_id: '1' } }); expect(r.statusCode).toBe(400); expect(r.json().error.code).toBe('VALIDATION_ERROR'); });
test('GET connectors lists all Appendix A manifest connectors', async () => { const r = await app.inject('/api/v1/connectors'); expect(r.statusCode).toBe(200); expect(r.json()).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'discourse', version: '1.0.0', surfaces: ['topic'] }), expect.objectContaining({ key: 'webhook', surfaces: ['post'] }), expect.objectContaining({ key: 'assisted', surfaces: ['pack'] })])); });
