/**
 * Checks failed certification persistence chooses a final or deferred cleanup status.
 * The outcome remains pure so tests can verify cleanup timing without a database.
 */
const { failedRunValues } = require('../../src/modules/certification/services/outcome');

test('uses failed when immediate cleanup deleted the test post', () => {
  const values = failedRunValues({ deleted: true, cleanup_due_at: null });
  expect(values).toEqual({ status: 'failed', test_post_deleted: true, cleanup_due_at: null });
});

test('uses cleanup_pending and preserves the computed due time when cleanup failed', () => {
  const dueAt = '2026-10-22T00:10:00.000Z';
  const values = failedRunValues({ deleted: false, cleanup_due_at: dueAt });
  expect(values).toEqual({ status: 'cleanup_pending', test_post_deleted: false, cleanup_due_at: dueAt });
});
