/**
 * Proves the worker claims durable jobs safely and records their terminal state.
 * The tests call runPending directly to keep queue timing deterministic.
 */
const { describe } = require('@jest/globals');
const { runPending } = require('../../../src/modules/jobs/worker');
const repository = require('../../../src/modules/jobs/repository');
const {
  createContext,
  resetJobs,
  createDestination,
  jobPayload,
  postJob,
  workerDeps
} = require('./helpers');

describe('jobs worker', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await createContext();
  });

  beforeEach(async () => {
    await resetJobs(ctx);
  });

  afterAll(async () => {
    await ctx.close();
  });

  test('runPending moves a certify job queued to running to succeeded with progress 100', async () => {
    const destination = await createDestination(ctx, 'discourse', 'normal');
    const created = await postJob(ctx, jobPayload(destination.id), 'worker-success-1');
    expect(await runPending(workerDeps(ctx))).toBe(1);
    const job = await ctx.knex('jobs').where({ id: created.json().job_id }).first();
    expect(job).toEqual(expect.objectContaining({ status: 'succeeded', progress: 100, attempts: 1 }));
  });

  test('certify job against a bad destination ends failed with a full error envelope', async () => {
    const created = await postJob(
      ctx,
      jobPayload('00000000-0000-4000-8000-000000000000'),
      'worker-bad-1'
    );
    await runPending(workerDeps(ctx));
    const job = await ctx.knex('jobs').where({ id: created.json().job_id }).first();
    expect(job.status).toBe('failed');
    expect(job.error).toEqual({
      code: 'NOT_FOUND',
      message: expect.any(String),
      retryable: false,
      details: expect.any(Object)
    });
  });

  test('two concurrent runPending calls never process the same job twice', async () => {
    const destination = await createDestination(ctx, 'discourse', 'normal');
    const created = await postJob(ctx, jobPayload(destination.id), 'worker-concurrent-1');
    const counts = await Promise.all([runPending(workerDeps(ctx)), runPending(workerDeps(ctx))]);
    const job = await ctx.knex('jobs').where({ id: created.json().job_id }).first();
    expect(counts[0] + counts[1]).toBe(1);
    expect(job.attempts).toBe(1);
    expect(await ctx.knex('certification_runs').where({ destination_id: destination.id })).toHaveLength(1);
  });

  test('stale running job is requeued and a job over max attempts fails', async () => {
    const old = new Date(Date.now() - 600000);
    const rows = await ctx.knex('jobs').insert([
      { type: 'certify', status: 'running', attempts: 1, input: {}, started_at: old },
      { type: 'certify', status: 'running', attempts: 3, input: {}, started_at: old }
    ]).returning('*');
    await repository.recoverStale(ctx.knex, ctx.app.config);
    const requeued = await ctx.knex('jobs').where({ id: rows[0].id }).first();
    const failed = await ctx.knex('jobs').where({ id: rows[1].id }).first();
    expect(requeued.status).toBe('queued');
    expect(failed.error).toEqual(expect.objectContaining({ code: 'INTERNAL_ERROR' }));
    expect(failed.status).toBe('failed');
  });
test('worker child logs include durable job and correlation identifiers', async () => {
  const destination = await createDestination(ctx, 'discourse', 'normal');
  const created = await postJob(ctx, jobPayload(destination.id), 'worker-log-1');
  const entries = [];
  const logger = { child(fields) { return { info(message) { entries.push({ fields, message }); }, warn() {} }; } };
  await runPending({ ...workerDeps(ctx), logger });
  expect(entries).toEqual(expect.arrayContaining([expect.objectContaining({ fields: expect.objectContaining({ job_id: created.json().job_id, correlation_id: expect.any(String) }) })]));
});
});
