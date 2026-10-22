/**
 * Tests pure cleanup-due and per-connector summary calculations in isolation.
 * Keeping these rules pure avoids hiding time arithmetic in database assertions.
 */
const { isDue, summarizeRuns } = require('../../src/modules/certification/services/summary');

const now = new Date('2026-10-22T10:10:00.000Z');

test('summary groups passed and failed runs by connector', () => {
  const rows = [
    { connector_key: 'discourse', status: 'passed', destination_id: 'one', duration_ms: 40 },
    { connector_key: 'discourse', status: 'failed', destination_id: 'two', duration_ms: 20 }
  ];
  expect(summarizeRuns(rows, now)).toEqual([expect.objectContaining({
    connector_key: 'discourse',
    runs: 2,
    passed: 1,
    failed: 1,
    avg_duration_ms: 30,
    destinations_certified: 1
  })]);
});

test('summary counts only undeleted test posts and calculates their age', () => {
  const rows = [{
    connector_key: 'webhook',
    status: 'cleanup_pending',
    destination_id: 'one',
    platform_post_id: 'post',
    test_post_deleted: false,
    started_at: new Date('2026-10-22T10:00:00.000Z'),
    duration_ms: 0
  }];
  expect(summarizeRuns(rows, now)).toEqual([expect.objectContaining({
    test_posts_left_undeleted: 1,
    max_minutes_alive: 10
  })]);
});

test('cleanup due selection accepts only pending rows at or before now', () => {
  expect(isDue({ status: 'cleanup_pending', cleanup_due_at: now }, now)).toBe(true);
  expect(isDue({ status: 'cleanup_pending', cleanup_due_at: new Date(now.getTime() + 1) }, now)).toBe(false);
  expect(isDue({ status: 'failed', cleanup_due_at: now }, now)).toBe(false);
});
