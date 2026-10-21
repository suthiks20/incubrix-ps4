/**
 * Locks the webhook HMAC protocol to an independently reproducible vector.
 * The fixed fake secret is safe because it is used only by local simulation.
 */
const { sign } = require('../../src/modules/connectors/webhook/sign');

test('signs the timestamp and exact raw body with HMAC-SHA256', () => {
  expect(sign('test-signing-secret', '1700000000', '{"title":"Hi"}')).toBe('sha256=36f7a60944667bc95d899265e9fc70ebac8db2b1808e94c59e05654b3b7d38e7');
});
