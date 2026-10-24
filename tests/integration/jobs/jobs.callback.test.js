/**
 * Verifies signed job callbacks and the metadata attached to worker log lines.
 * Callback receivers are in-process HTTP servers so no external service is contacted.
 */
const { describe } = require('@jest/globals');
const http = require('http');
const { PassThrough } = require('stream');
const pino = require('pino');
const { runPending } = require('../../../src/modules/jobs/worker');
const { sign } = require('../../../src/modules/jobs/callbackSign');
const {
  createContext,
  resetJobs,
  createDestination,
  jobPayload,
  postJob,
  workerDeps
} = require('./helpers');

function createReceiver(statusCode = 200) {
  let resolveRequest;
  const received = new Promise((resolve) => { resolveRequest = resolve; });
  const server = http.createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    resolveRequest({ body, headers: request.headers });
    response.statusCode = statusCode;
    response.end('ok');
  });
  return { server, received };
}

async function listen(receiver) {
  await new Promise((resolve) => receiver.server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${receiver.server.address().port}/callback`;
}

async function close(receiver) {
  await new Promise((resolve) => receiver.server.close(resolve));
}

describe('jobs callbacks', () => {
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

  test('callback is signed and verifies with the shared secret', async () => {
    const receiver = createReceiver();
    const callbackUrl = await listen(receiver);
    const destination = await createDestination(ctx, 'discourse', 'normal');
    const created = await postJob(ctx, jobPayload(destination.id, { callback_url: callbackUrl }), 'callback-signed-1');
    await runPending(workerDeps(ctx));
    const request = await receiver.received;
    const job = await ctx.knex('jobs').where({ id: created.json().job_id }).first();
    expect(request.headers['x-incubrix-signature']).toBe(sign(
      ctx.app.config.JOBS_CALLBACK_SECRET,
      request.headers['x-incubrix-timestamp'],
      request.body
    ));
    expect(job.callback_status).toBe('delivered');
    await close(receiver);
  });

  test('callback failure does not fail the job and sets callback_status failed', async () => {
    const destination = await createDestination(ctx, 'discourse', 'normal');
    const created = await postJob(
      ctx,
      jobPayload(destination.id, { callback_url: 'http://127.0.0.1:1/unavailable' }),
      'callback-failure-1'
    );
    await runPending(workerDeps(ctx));
    const job = await ctx.knex('jobs').where({ id: created.json().job_id }).first();
    expect(job.status).toBe('succeeded');
    expect(job.callback_status).toBe('failed');
  });

  test('job log lines carry job_id and correlation_id', async () => {
    await ctx.close();
    const stream = new PassThrough();
    let logs = '';
    stream.on('data', (chunk) => { logs += chunk.toString(); });
    ctx = await createContext({ logger: pino({}, stream) });
    await resetJobs(ctx);
    const destination = await createDestination(ctx, 'discourse', 'normal');
    const created = await postJob(ctx, jobPayload(destination.id), 'callback-logs-1');
    await runPending(workerDeps(ctx));
    const job = await ctx.knex('jobs').where({ id: created.json().job_id }).first();
    const jobLogs = logs.split('\n').filter(Boolean).map((line) => JSON.parse(line))
      .filter((line) => line.job_id === job.id);
    expect(jobLogs.length).toBeGreaterThan(0);
    expect(jobLogs.every((line) => line.correlation_id === job.correlation_id)).toBe(true);
  });
});
