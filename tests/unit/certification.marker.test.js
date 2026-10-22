/**
 * Checks certification uses a stable, opaque marker from its idempotency key.
 * The marker allows cleanup recovery without putting the original key in a post.
 */
const { markerFor } = require('../../src/modules/connectors/commons/marker');

test('creates a stable 16-character marker without exposing the idempotency key', () => {
  const marker = markerFor('certification-key-123');
  expect(marker).toMatch(/^[a-f0-9]{16}$/);
  expect(markerFor('certification-key-123')).toBe(marker);
  expect(marker).not.toContain('certification-key-123');
});
