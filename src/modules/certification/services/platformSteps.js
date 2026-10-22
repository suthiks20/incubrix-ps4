/**
 * The platform-facing certification steps: publish a labelled test post, check it, delete it.
 * Each step is a small function so the run orchestrator reads like a checklist.
 */
const AppError = require('../../../shared/errors/AppError');

const SKIPPED_FOR_ASSISTED = ['publish', 'confirm_live', 'read_status', 'delete', 'verify_gone'];

function testRendition(destination, runId) {
  return {
    title: `[IncuBrix certification test] ${runId.slice(0, 8)}`,
    body: 'Automated IncuBrix certification post. It will be deleted within 10 minutes.',
    language: destination.language,
    is_promotional: false,
    ai_generated: false
  };
}

function unavailable(message) {
  return new AppError('PLATFORM_UNAVAILABLE', message, { statusCode: 503, retryable: true });
}

function validateStep(ctx) {
  return ctx.recorder.run('validate', async () => {
    const violations = ctx.connector.validate(ctx.rendition);
    if (violations.length > 0) {
      const details = { violations };
      throw new AppError('DEST_SPEC_VIOLATION', 'Test rendition breaks the format limits', {
        statusCode: 400,
        details
      });
    }
    return { summary: 'test rendition passes the destination format limits' };
  });
}

function publishStep(ctx) {
  return ctx.recorder.run('publish', async () => {
    ctx.post = await ctx.connector.publish(ctx.rendition, ctx.destination, ctx.connection, ctx.publishKey);
    return { summary: `created post ${ctx.post.platform_post_id} at ${ctx.post.live_url}` };
  });
}

function confirmLiveStep(ctx) {
  return ctx.recorder.run('confirm_live', async () => {
    const current = await readStatus(ctx);
    if (current.status !== 'published' || !current.live_url) throw unavailable('Test post is not live');
    return { summary: `post is live at ${current.live_url}` };
  });
}

function readStatusStep(ctx) {
  return ctx.recorder.run('read_status', async () => {
    const current = await readStatus(ctx);
    if (current.live_url !== ctx.post.live_url) {
      throw new AppError('SCHEMA_DRIFT', 'Live URL changed between publish and status', {
        statusCode: 502
      });
    }
    return { summary: 'status read again and the live URL matches the publish result' };
  });
}

function deleteStep(ctx) {
  return ctx.recorder.run('delete', async () => {
    const id = ctx.post.platform_post_id;
    const removed = await ctx.connector.delete(ctx.destination, ctx.connection, id);
    if (!removed.deleted) throw unavailable('Platform did not confirm the delete');
    ctx.deleted = true;
    return { summary: `deleted post ${id}` };
  });
}

function verifyGoneStep(ctx) {
  return ctx.recorder.run('verify_gone', async () => {
    const current = await readStatus(ctx);
    if (current.status !== 'deleted') throw unavailable('Test post is still live after delete');
    return { summary: 'platform reports the test post as deleted' };
  });
}

function readStatus(ctx) {
  const id = ctx.post.platform_post_id;
  return ctx.connector.get_status(ctx.destination, ctx.connection, id);
}

async function runPlatformSteps(ctx) {
  await validateStep(ctx);
  await publishStep(ctx);
  await confirmLiveStep(ctx);
  await readStatusStep(ctx);
  await deleteStep(ctx);
  await verifyGoneStep(ctx);
}

async function runAssistedSteps(ctx) {
  await validateStep(ctx);
  await ctx.recorder.run('build_assist_pack', async () => {
    const pack = ctx.connector.build_assist_pack(ctx.rendition, ctx.destination);
    return { summary: `built a posting pack with ${pack.checklist.length} checklist items` };
  });
  SKIPPED_FOR_ASSISTED.forEach((name) => {
    ctx.recorder.skip(name, 'assisted tier: a person posts');
  });
}

// After a failure every step that never ran is recorded as skipped, so the run shows all steps.
function skipAfterFailure(ctx) {
  const order = ctx.entry.manifest.tier === 'assisted'
    ? ['validate', 'build_assist_pack', ...SKIPPED_FOR_ASSISTED]
    : ['validate', ...SKIPPED_FOR_ASSISTED];
  const recorded = ctx.recorder.steps();
  const failed = recorded.find((step) => step.status === 'failed');
  const remaining = order.filter((name) => !recorded.some((step) => step.name === name));
  if (failed) ctx.recorder.skipRest(failed.name, remaining);
}

module.exports = { testRendition, runPlatformSteps, runAssistedSteps, skipAfterFailure };
