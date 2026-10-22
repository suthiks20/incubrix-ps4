/**
 * Checks one immediate cleanup attempt reports success or a deferred deadline.
 * The janitor will later consume the deferred result in WP1.
 */
const { attemptImmediateCleanup } = require('../../src/modules/certification/services/immediateCleanup');

test('reports a deleted post when one immediate delete succeeds', async () => {
  const connector = { delete: jest.fn().mockResolvedValue({ deleted: true }) };
  const result = await attemptImmediateCleanup({ connector, destination: {}, connection: {}, post: { platform_post_id: '1' } }, new Date('2026-10-22T00:00:00.000Z'), 10);
  expect(connector.delete).toHaveBeenCalledTimes(1);
  expect(result).toEqual({ attempted: true, deleted: true, cleanup_due_at: null });
});

test('reports a deferred deadline when the one immediate delete fails', async () => {
  const connector = { delete: jest.fn().mockRejectedValue(new Error('offline')) };
  const now = new Date('2026-10-22T00:00:00.000Z');
  const result = await attemptImmediateCleanup({ connector, destination: {}, connection: {}, post: { platform_post_id: '1' } }, now, 10);
  expect(connector.delete).toHaveBeenCalledTimes(1);
  expect(result).toEqual({ attempted: true, deleted: false, cleanup_due_at: '2026-10-22T00:10:00.000Z' });
});
