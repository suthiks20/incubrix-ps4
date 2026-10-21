/**
 * Locks the webhook HMAC protocol to an independently reproducible vector.
 * The fixed fake secret is safe because it is used only by local simulation.
 */
const { sign } = require('../../src/modules/connectors/webhook/sign');
const { createWebhook } = require('../../src/modules/connectors/webhook');

test('signs the timestamp and exact raw body with HMAC-SHA256', () => {
  expect(sign('test-signing-secret', '1700000000', '{"title":"Hi"}')).toBe('sha256=36f7a60944667bc95d899265e9fc70ebac8db2b1808e94c59e05654b3b7d38e7');
});
test('findByMarker ignores unrelated or unmarked partner posts', async () => {
  const response = { ok: true, status: 200, headers: new Headers(), json: async () => ({ posts: [{ id: 1, url: 'https://partner.test/1', ix_ref: 'other' }, { id: 2, url: 'https://partner.test/2' }] }) };
  const connector = createWebhook({ fetch: async () => response, config: { CONNECTOR_HTTP_TIMEOUT_MS: 100, CONNECTOR_MAX_BACKOFF_MS: 0, CIRCUIT_FAILURE_THRESHOLD: 5, CIRCUIT_COOLDOWN_SECONDS: 1 } });
  await expect(connector.findByMarker({ config: { base_url: 'https://partner.test' } }, { signing_secret: 'fake' }, 'wanted')).resolves.toBeNull();
});
