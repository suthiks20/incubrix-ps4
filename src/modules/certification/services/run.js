/**
 * Certifies one destination: validate, publish a test post, check it, delete it, store evidence.
 * It talks to the connector directly, so it never uses the rules engine or the publish ledger.
 */
const crypto = require('crypto');
const registry = require('../../connectors/registry');
const destinationsRepo = require('../../destinations/repository/destinations');
const { resolveConnection } = require('../../../shared/connections/resolve');
const { assertCanCertify } = require('./preconditions');
const { createRecorder } = require('./steps');
const { storeEvidence } = require('./evidence');
const platform = require('./platformSteps');
const outcome = require('./outcome');
const { markerFor } = require('../../connectors/commons/marker');
const { attemptImmediateCleanup } = require('./immediateCleanup');

async function loadTarget(deps, destinationId) {
  const destination = await destinationsRepo.findById(deps.knex, destinationId);
  const entry = destination ? registry.get(destination.connector_key) : undefined;
  assertCanCertify({
    destination,
    connector: entry ? entry.manifest : undefined,
    config: deps.config,
    disabledConnectors: deps.config.CONNECTORS_DISABLED
  });
  return { destination, entry };
}

function buildContext(deps, destination, entry) {
  const runId = crypto.randomUUID();
  const options = { config: deps.config, logger: deps.logger };
  return {
    runId,
    destination,
    entry,
    connector: deps.connectorFactory ? deps.connectorFactory(entry) : entry.createConnector(options),
    connection: resolveConnection(destination, deps.config),
    recorder: createRecorder(deps.now),
    rendition: platform.testRendition(destination, runId),
    publishKey: `cert-${runId}`,
    post: null,
    deleted: false,
    cleanup: null
  };
}

async function recoverPost(ctx) {
  if (ctx.post) return;
  try {
    ctx.post = await ctx.connector.findByMarker(ctx.destination, ctx.connection, markerFor(ctx.publishKey));
  } catch {
    // The original certification failure remains the client-visible failure.
  }
}

async function cleanupAfterFailure(ctx, deps) {
  await recoverPost(ctx);
  if (!ctx.post || ctx.deleted) return;
  try {
    await ctx.recorder.run('cleanup', async () => {
      ctx.cleanup = await attemptImmediateCleanup(ctx, deps.now(), deps.config.CERT_TEST_POST_TTL_MINUTES);
      if (!ctx.cleanup.deleted) throw ctx.cleanup.error;
      ctx.deleted = true;
      return { summary: `immediate cleanup deleted post ${ctx.post.platform_post_id}` };
    });
  } catch {
    // Cleanup details are persisted with the original certification failure.
  }
}

async function executeSteps(ctx) {
  try {
    if (ctx.entry.manifest.tier === 'assisted') await platform.runAssistedSteps(ctx);
    else await platform.runPlatformSteps(ctx);
    return null;
  } catch (error) {
    platform.skipAfterFailure(ctx);
    return error;
  }
}

async function runCertification(deps, destinationId) {
  const { destination, entry } = await loadTarget(deps, destinationId);
  const startedAt = deps.now();
  const ctx = buildContext(deps, destination, entry);
  const failure = await executeSteps(ctx);
  if (failure) await cleanupAfterFailure(ctx, deps);
  const result = {
    runId: ctx.runId,
    destination,
    connectorKey: entry.manifest.key,
    tier: entry.manifest.tier,
    post: ctx.post,
    deleted: ctx.deleted,
    cleanup_due_at: ctx.cleanup ? ctx.cleanup.cleanup_due_at : null,
    steps: ctx.recorder.steps(),
    startedAt,
    finishedAt: deps.now(),
    evidenceKey: `certification/${destination.id}/${ctx.runId}.json`
  };
  await storeEvidence(deps.storage, result, entry.manifest, failure);
  const save = failure ? outcome.recordFailed(deps, result, failure) : outcome.recordPassed(deps, result);
  const row = await save;
  return { ...row, evidence_link: `/api/v1/certification/runs/${row.id}/evidence` };
}

module.exports = { runCertification };
