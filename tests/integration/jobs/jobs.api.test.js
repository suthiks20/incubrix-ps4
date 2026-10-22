/**
 * Exercises the jobs HTTP contract against the real Postgres queue table.
 * Queue work is invoked directly so these tests do not depend on polling timers.
 */
const { describe } = require('@jest/globals');
const { runPending } = require('../../../src/modules/jobs/worker');
const {
  createContext,
  resetJobs,
  createDestination,
  jobPayload,
  postJob,
  workerDeps,
  expectError
} = require('./helpers');

describe('jobs API', () => {
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

  test('POST /jobs returns 202 with job_id and queued status', async () => {
    const destination = await createDestination(ctx, 'discourse', 'normal');
    const response = await postJob(ctx, jobPayload(destination.id), 'job-create-1');
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ job_id: expect.any(String), status: 'queued', progress: 0 });
  });

  test('POST /jobs without Idempotency-Key returns IDEMPOTENCY_KEY_REQUIRED', async () => {
    const destination = await createDestination(ctx, 'discourse', 'normal');
    const response = await postJob(ctx, jobPayload(destination.id));
    expectError(response, 400, 'IDEMPOTENCY_KEY_REQUIRED');
  });

  test('HARD CASE same idempotency key returns the same job and runs the work once', async () => {
    const destination = await createDestination(ctx, 'discourse', 'normal');
    const body = jobPayload(destination.id);
    const first = await postJob(ctx, body, 'job-replay-1');
    const second = await postJob(ctx, body, 'job-replay-1');
    expect(second.statusCode).toBe(202);
    expect(second.json().job_id).toBe(first.json().job_id);
    expect(await runPending(workerDeps(ctx))).toBe(1);
    expect(await ctx.knex('certification_runs').where({ destination_id: destination.id })).toHaveLength(1);
  });

  test('same idempotency key with a different body returns IDEMPOTENCY_KEY_CONFLICT', async () => {
    const firstDestination = await createDestination(ctx, 'discourse', 'normal');
    const secondDestination = await createDestination(ctx, 'discourse', 'unavailable');
    await postJob(ctx, jobPayload(firstDestination.id), 'job-conflict-1');
    const response = await postJob(ctx, jobPayload(secondDestination.id), 'job-conflict-1');
    expectError(response, 409, 'IDEMPOTENCY_KEY_CONFLICT');
  });

  test('unknown job type returns JOB_TYPE_UNKNOWN', async () => {
    const response = await postJob(ctx, { type: 'missing', input: {} }, 'job-unknown-1');
    expectError(response, 400, 'JOB_TYPE_UNKNOWN');
  });

  test('invalid callback_url returns VALIDATION_ERROR', async () => {
    const destination = await createDestination(ctx, 'discourse', 'normal');
    const response = await postJob(ctx, jobPayload(destination.id, { callback_url: 'ftp://example.test' }), 'job-url-1');
    expectError(response, 400, 'VALIDATION_ERROR');
  });

  test('GET /jobs/:id returns status progress and result links', async () => {
    const destination = await createDestination(ctx, 'discourse', 'normal');
    const created = await postJob(ctx, jobPayload(destination.id), 'job-read-1');
    await runPending(workerDeps(ctx));
    const response = await ctx.app.inject({ method: 'GET', url: `/api/v1/jobs/${created.json().job_id}` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expect.objectContaining({
      status: 'succeeded',
      progress: 100,
      result: expect.objectContaining({ run_id: expect.any(String) }),
      links: expect.objectContaining({ run: expect.any(String), evidence: expect.any(String) })
    }));
  });

  test('GET /jobs/:id unknown id returns NOT_FOUND', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/jobs/00000000-0000-4000-8000-000000000000'
    });
    expectError(response, 404, 'NOT_FOUND');
  });

  test('GET /jobs lists newest first and filters by status', async () => {
    const first = await ctx.knex('jobs').insert({ type: 'certify', status: 'queued', input: {} }).returning('*');
    await ctx.knex('jobs').insert({ type: 'certify', status: 'failed', input: {} });
    const response = await ctx.app.inject({ method: 'GET', url: '/api/v1/jobs?status=queued&limit=10' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0].job_id).toBe(first[0].id);
  });
});
