/**
 * Shows multiple platform instances are catalogue rows rather than code changes.
 * Both forum records share a connector key while using different public base URLs.
 */
const { createDestinationContext, destinationInput, postDestination, clearDestinations } = require('../destinationTestHelpers');
let context;
beforeAll(async () => { context = await createDestinationContext(); await context.app.listen({ port: 0, host: '127.0.0.1' }); });
afterAll(async () => { await context.app.close(); await context.knex.destroy(); });
beforeEach(async () => clearDestinations(context.knex));
test('creates two Discourse instances by API with different configs', async () => {
  const first = await postDestination(context.app, destinationInput({ name: 'Forum A', url: 'https://forum-a.example.com', config: { base_url: 'https://forum-a.example.com' } }));
  const second = await postDestination(context.app, destinationInput({ name: 'Forum B', url: 'https://forum-b.example.com', config: { base_url: 'https://forum-b.example.com' } }));
  expect(first.statusCode).toBe(201);
  expect(second.statusCode).toBe(201);
  const listed = await context.app.inject('/api/v1/destinations?connector_key=discourse');
  expect(listed.json().items).toHaveLength(2);
});
test('same webhook connector obeys each destination row promotion rule', async () => {
  const root = `http://127.0.0.1:${context.app.server.address().port}/mock/webhook/normal`;
  const allowed = await postDestination(context.app, destinationInput({ name: 'Webhook allows promo', url: `${root}/a`, platform_key: 'webhook', connector_key: 'webhook', config: { base_url: root }, self_promo_allowed: true }));
  const blocked = await postDestination(context.app, destinationInput({ name: 'Webhook bans promo', url: `${root}/b`, platform_key: 'webhook', connector_key: 'webhook', config: { base_url: root }, self_promo_allowed: false }));
  const base = { connection: { signing_secret: 'test-signing-secret' }, rendition: { title: 'Promo title', body: 'Buy now', is_promotional: true } };
  const yes = await context.app.inject({ method: 'POST', url: '/connector/v1/webhook/publish', payload: { ...base, idempotency_key: 'config-webhook-yes', destination_id: allowed.json().id } });
  const no = await context.app.inject({ method: 'POST', url: '/connector/v1/webhook/publish', payload: { ...base, idempotency_key: 'config-webhook-no', destination_id: blocked.json().id } });
  expect(yes.statusCode).toBe(200); expect(no.statusCode).toBe(422); expect(no.json().error.code).toBe('DEST_RULE_VIOLATION');
});
