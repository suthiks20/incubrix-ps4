/**
 * Calculates connector-level certification metrics from durable run rows.
 * The injected clock keeps remaining test-post age deterministic and testable.
 */
const runs = require('../repository/runs');

function isDue(run, now) {
  return run.status === 'cleanup_pending' && new Date(run.cleanup_due_at).getTime() <= now.getTime();
}

function initialSummary(connectorKey) {
  return {
    connector_key: connectorKey,
    runs: 0,
    passed: 0,
    failed: 0,
    duration_total: 0,
    destinations: new Set(),
    test_posts_left_undeleted: 0,
    max_minutes_alive: 0
  };
}

function addRun(summary, run, now) {
  summary.runs += 1;
  summary.duration_total += Number(run.duration_ms || 0);
  if (run.status === 'passed') {
    summary.passed += 1;
    summary.destinations.add(run.destination_id);
  }
  if (run.status === 'failed' || run.status === 'cleanup_pending') summary.failed += 1;
  if (run.platform_post_id && !run.test_post_deleted) {
    summary.test_posts_left_undeleted += 1;
    const minutes = Math.max(0, (now.getTime() - new Date(run.started_at).getTime()) / 60000);
    summary.max_minutes_alive = Math.max(summary.max_minutes_alive, minutes);
  }
}

function publicSummary(summary) {
  return {
    connector_key: summary.connector_key,
    runs: summary.runs,
    passed: summary.passed,
    failed: summary.failed,
    avg_duration_ms: summary.runs ? summary.duration_total / summary.runs : 0,
    destinations_certified: summary.destinations.size,
    test_posts_left_undeleted: summary.test_posts_left_undeleted,
    max_minutes_alive: summary.max_minutes_alive
  };
}

function summarizeRuns(rows, now) {
  const grouped = new Map();
  for (const run of rows) {
    const summary = grouped.get(run.connector_key) || initialSummary(run.connector_key);
    addRun(summary, run, now);
    grouped.set(run.connector_key, summary);
  }
  return [...grouped.values()].map(publicSummary);
}

async function getSummary(deps) {
  return summarizeRuns(await runs.listForSummary(deps.knex), deps.now());
}

module.exports = { isDue, summarizeRuns, getSummary };
