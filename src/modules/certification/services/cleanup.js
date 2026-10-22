/**
 * Retries due certification post deletions and records a durable cleanup outcome.
 * Connections are resolved only for the delete call and are never persisted or logged.
 */
const registry = require('../../connectors/registry');
const destinations = require('../../destinations/repository/destinations');
const { resolveConnection } = require('../../../shared/connections/resolve');
const runs = require('../repository/runs');
const alerts = require('../repository/alerts');

function connectorFor(deps, entry) {
  if (deps.connectorFactory) return deps.connectorFactory(entry);
  return entry.createConnector({ config: deps.config, logger: deps.logger });
}

function cleanupEvidenceKey(run) {
  return `certification/${run.destination_id}/${run.id}.cleanup.json`;
}

function minutesAfterPublish(run, now) {
  return Math.max(0, (now.getTime() - new Date(run.started_at).getTime()) / 60000);
}

async function cleanSucceededRun(deps, run, now) {
  await runs.update(deps.knex, run.id, {
    status: 'failed',
    test_post_deleted: true,
    cleanup_due_at: null,
    cleaned_at: now
  });
  await deps.storage.put(cleanupEvidenceKey(run), JSON.stringify({
    deleted_at: now.toISOString(),
    minutes_after_publish: minutesAfterPublish(run, now)
  }, null, 2), 'application/json');
}

async function recordCleanupFailure(deps, run, now, error) {
  const dueAt = new Date(now.getTime() + 60 * 1000);
  await runs.update(deps.knex, run.id, { cleanup_due_at: dueAt });
  const existing = await alerts.findByRunAndKind(deps.knex, run.id, 'cleanup_failed');
  if (existing) return;
  await alerts.insert(deps.knex, {
    destination_id: run.destination_id,
    run_id: run.id,
    kind: 'cleanup_failed',
    message: 'Certification cleanup failed',
    details: { code: error.code || 'INTERNAL_ERROR', run_id: run.id }
  });
}

async function cleanRun(deps, run, now) {
  try {
    const destination = await destinations.findById(deps.knex, run.destination_id);
    const entry = registry.get(run.connector_key);
    const connector = connectorFor(deps, entry);
    const connection = resolveConnection(destination, deps.config);
    const result = await connector.delete(destination, connection, run.platform_post_id);
    if (!result.deleted) throw new Error('Delete was not confirmed');
    await cleanSucceededRun(deps, run, now);
    return true;
  } catch (error) {
    await recordCleanupFailure(deps, run, now, error);
    deps.logger.warn({ run_id: run.id }, 'Certification cleanup failed');
    return false;
  }
}

async function runCleanup(deps) {
  const now = deps.now();
  const dueRuns = await runs.findDueForCleanup(deps.knex, now);
  const summary = { checked: dueRuns.length, cleaned: 0, failed: 0 };
  for (const run of dueRuns) {
    if (await cleanRun(deps, run, now)) summary.cleaned += 1;
    else summary.failed += 1;
  }
  return summary;
}

module.exports = { runCleanup };
