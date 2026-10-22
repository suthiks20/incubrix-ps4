/**
 * Covers due certification cleanup and connector-level summary HTTP behavior.
 * The injected clock makes retry deadlines deterministic against real Postgres.
 */
const fs = require('fs/promises');
const { randomUUID } = require('crypto');
const { runCleanup } = require('../../../src/modules/certification/services/cleanup');
const { createContext, reset, createDestination, certify, mockState } = require('./helpers');

let ctx;
let currentTime;

function deps(overrides = {}) {
  return {
    knex: ctx.knex,
    config: ctx.app.config,
    logger: ctx.app.log,
    storage: ctx.app.storage,
    now: () => currentTime,
    connectorFactory: ctx.app.connectorFactory,
    ...overrides
  };
}

async function createPendingRun() {
  const destination = await createDestination(ctx, 'discourse', 'delete_fails_twice');
  const response = await certify(ctx, destination.id, `cleanup-${randomUUID()}`);
  return { destination, run: response.json() };
}

beforeAll(async () => {
  currentTime = new Date('2026-10-22T10:00:00.000Z');
  ctx = await createContext({ now: () => currentTime });
});
beforeEach(async () => {
  currentTime = new Date('2026-10-22T10:00:00.000Z');
  await reset(ctx);
});
afterAll(async () => {
  await ctx.close();
});

test('HARD CASE janitor deletes a leftover test post once it is due', async () => {
  const { destination, run } = await createPendingRun();
  expect(await runCleanup(deps())).toEqual({ checked: 0, cleaned: 0, failed: 0 });
  currentTime = new Date(run.cleanup_due_at);
  expect(await runCleanup(deps())).toEqual({ checked: 1, cleaned: 1, failed: 0 });
  expect((await mockState(ctx, 'discourse', 'delete_fails_twice')).posts).toHaveLength(0);
  const row = await ctx.knex('certification_runs').where({ id: run.id }).first();
  expect(new Date(row.cleaned_at).toISOString()).toBe(currentTime.toISOString());
  const key = `certification/${destination.id}/${run.id}.cleanup.json`;
  const evidence = JSON.parse(await fs.readFile(`${ctx.directory}/${key}`, 'utf8'));
  expect(evidence).toEqual(expect.objectContaining({ deleted_at: currentTime.toISOString() }));
  expect(evidence.minutes_after_publish).toBeGreaterThanOrEqual(10);
});

test('janitor ignores runs that are not due', async () => {
  const { run } = await createPendingRun();
  expect(new Date(run.cleanup_due_at).getTime()).toBeGreaterThan(currentTime.getTime());
  expect(await runCleanup(deps())).toEqual({ checked: 0, cleaned: 0, failed: 0 });
});

test('janitor failure keeps the run pending and raises one cleanup_failed alert', async () => {
  const destination = await createDestination(ctx, 'discourse', 'normal');
  const runId = randomUUID();
  await ctx.knex('certification_runs').insert({
    id: runId,
    destination_id: destination.id,
    connector_key: 'discourse',
    status: 'cleanup_pending',
    platform_post_id: 'missing',
    cleanup_due_at: currentTime,
    started_at: currentTime,
    steps: JSON.stringify([])
  });
  const connectorFactory = () => ({ delete: async () => { throw new Error('delete failed'); } });
  expect(await runCleanup(deps({ connectorFactory }))).toEqual({ checked: 1, cleaned: 0, failed: 1 });
  currentTime = new Date(currentTime.getTime() + 60 * 1000);
  expect(await runCleanup(deps({ connectorFactory }))).toEqual({ checked: 1, cleaned: 0, failed: 1 });
  const run = await ctx.knex('certification_runs').where({ id: runId }).first();
  expect(run.status).toBe('cleanup_pending');
  expect(new Date(run.cleanup_due_at).toISOString()).toBe('2026-10-22T10:02:00.000Z');
  const alerts = await ctx.knex('destination_alerts').where({
    run_id: runId,
    kind: 'cleanup_failed'
  });
  expect(alerts).toHaveLength(1);
});

test('POST /certification/cleanup returns a summary', async () => {
  const { run } = await createPendingRun();
  currentTime = new Date(run.cleanup_due_at);
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/v1/certification/cleanup',
    headers: { 'idempotency-key': 'cleanup-once' }
  });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ checked: 1, cleaned: 1, failed: 0 });
});

test('summary reports per-connector metrics', async () => {
  const first = await createDestination(ctx, 'discourse', 'normal');
  const secondUrl = `${ctx.mockRoot}/discourse/normal/`;
  const second = await createDestination(ctx, 'discourse', 'normal', {
    url: secondUrl,
    url_normalized: secondUrl,
    config: JSON.stringify({ base_url: secondUrl })
  });
  const failed = await createDestination(ctx, 'discourse', 'unavailable');
  await certify(ctx, first.id, 'summary-first');
  await certify(ctx, second.id, 'summary-second');
  await certify(ctx, failed.id, 'summary-failed');
  const response = await ctx.app.inject({ method: 'GET', url: '/api/v1/certification/summary' });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual([expect.objectContaining({
    connector_key: 'discourse',
    runs: 3,
    passed: 2,
    failed: 1,
    destinations_certified: 2,
    test_posts_left_undeleted: 0
  })]);
});

test('cleanup without Idempotency-Key returns the common error envelope', async () => {
  const response = await ctx.app.inject({ method: 'POST', url: '/api/v1/certification/cleanup' });
  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({
    error: expect.objectContaining({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      message: expect.any(String),
      retryable: expect.any(Boolean),
      details: expect.any(Object)
    })
  });
});
