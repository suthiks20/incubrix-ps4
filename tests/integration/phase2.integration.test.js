/**
 * Verifies the Integration Standard phase 2 requirements for manifests, rate limits, and OpenAPI parity.
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const buildApp = require('../../src/app');
const { createContext, resetJobs, createDestination, postJob, workerDeps } = require('./jobs/helpers');
const { createTestDatabase } = require('./testDatabase');
const baseConfig = require('../../src/config');
const { describe } = require('@jest/globals');

describe('phase 2 integration standard', () => {
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

  test('every job result links a manifest with all required keys', async () => {
    const destination = await createDestination(ctx, 'discourse', 'normal');
    const created = await postJob(ctx, { type: 'certify', input: { destination_id: destination.id } }, 'manifest-job-1');
    await require('../../src/modules/jobs/worker').runPending(workerDeps(ctx));
    const response = await ctx.app.inject(`/api/v1/jobs/${created.json().job_id}`);
    expect(response.statusCode).toBe(200);
    expect(response.json().links).toEqual(expect.objectContaining({ output: expect.any(String), manifest: expect.any(String) }));
    const manifest = await ctx.app.inject(response.json().links.manifest);
    expect(manifest.statusCode).toBe(200);
    expect(manifest.json()).toEqual(expect.objectContaining({
      providers: expect.any(Array),
      settings: expect.any(Object),
      seed: expect.any(String),
      timings: expect.objectContaining({ duration_ms: expect.any(Number) }),
      cost_estimate: expect.objectContaining({ currency: 'USD', amount: expect.any(Number) }),
      warnings: expect.any(Array),
      licence_rights: expect.any(Object)
    }));
    expect(manifest.json().ai_generated).toBe(false);
  });

  test('manifest records real timings and providers', async () => {
    const destination = await createDestination(ctx, 'discourse', 'normal');
    const created = await postJob(ctx, { type: 'certify', input: { destination_id: destination.id } }, 'manifest-job-2');
    await require('../../src/modules/jobs/worker').runPending(workerDeps(ctx));
    const response = await ctx.app.inject(`/api/v1/jobs/${created.json().job_id}`);
    const manifest = await ctx.app.inject(response.json().links.manifest);
    const payload = manifest.json();
    expect(payload.started_at).toEqual(expect.any(String));
    expect(payload.finished_at).toEqual(expect.any(String));
    expect(new Date(payload.finished_at).getTime()).toBeGreaterThanOrEqual(new Date(payload.started_at).getTime());
    expect(payload.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'connector', version: expect.any(String) }),
      expect.objectContaining({ kind: 'storage', key: expect.any(String) }),
      expect.objectContaining({ kind: 'llm', key: expect.any(String) })
    ]));
  });

  test('rate limiter returns RATE_LIMITED after the configured count', async () => {
    const knex = createTestDatabase();
    const app = buildApp({
      knex,
      apiToken: '',
      config: { ...baseConfig, RATE_LIMIT_PER_MINUTE: 3 }
    });
    await app.ready();
    try {
      expect((await app.inject('/api/v1/destinations')).statusCode).toBe(200);
      expect((await app.inject('/api/v1/destinations')).statusCode).toBe(200);
      expect((await app.inject('/api/v1/destinations')).statusCode).toBe(200);
      const response = await app.inject('/api/v1/destinations');
      expect(response.statusCode).toBe(429);
      expect(response.headers['retry-after']).toBe('60');
      expect(response.json()).toEqual({
        error: expect.objectContaining({ code: 'RATE_LIMITED', retryable: true, details: expect.any(Object) })
      });
    } finally {
      await app.close();
      await knex.destroy();
    }
  });

  test('health is exempt from the rate limit', async () => {
    const knex = createTestDatabase();
    const app = buildApp({
      knex,
      apiToken: '',
      config: { ...baseConfig, RATE_LIMIT_PER_MINUTE: 1 }
    });
    await app.ready();
    try {
      for (let i = 0; i < 5; i += 1) {
        const response = await app.inject('/health');
        expect(response.statusCode).toBe(200);
      }
    } finally {
      await app.close();
      await knex.destroy();
    }
  });

  test('openapi.yaml matches the registered routes exactly', async () => {
    const app = ctx.app;
    const spec = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../openapi.yaml'), 'utf8'));
    const expected = new Set();
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const method of Object.keys(methods)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          expected.add(`${method.toUpperCase()} ${path}`);
        }
      }
    }
    const actual = new Set();
    for (const entry of app.routeIndex) {
      actual.add(entry);
    }
    expect([...actual].sort()).toEqual([...expected].sort());
  });

  test('unknown job type returns JOB_TYPE_UNKNOWN', async () => {
    const response = await postJob(ctx, { type: 'missing', input: {} }, 'job-unknown-2');
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('JOB_TYPE_UNKNOWN');
  });

  test('job type selftest returns JOB_TYPE_NOT_READY', async () => {
    const response = await postJob(ctx, { type: 'selftest', input: {} }, 'job-selftest-1');
    expect(response.statusCode).toBe(202);
    await require('../../src/modules/jobs/worker').runPending(workerDeps(ctx));
    const read = await ctx.app.inject(`/api/v1/jobs/${response.json().job_id}`);
    expect(read.json().error.code).toBe('JOB_TYPE_NOT_READY');
  });

  test('catalogue_import with empty input fails the job with a VALIDATION_ERROR envelope', async () => {
    const response = await postJob(ctx, { type: 'catalogue_import', input: {} }, 'job-import-1');
    expect(response.statusCode).toBe(202);
    await require('../../src/modules/jobs/worker').runPending(workerDeps(ctx));
    const read = await ctx.app.inject(`/api/v1/jobs/${response.json().job_id}`);
    expect(read.json()).toEqual(expect.objectContaining({
      status: 'failed',
      error: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        retryable: expect.any(Boolean),
        details: expect.any(Object)
      })
    }));
  });

  test('job type batch_publish returns JOB_TYPE_NOT_READY', async () => {
    const response = await postJob(ctx, { type: 'batch_publish', input: {} }, 'job-batch-1');
    expect(response.statusCode).toBe(202);
    await require('../../src/modules/jobs/worker').runPending(workerDeps(ctx));
    const read = await ctx.app.inject(`/api/v1/jobs/${response.json().job_id}`);
    expect(read.json().error.code).toBe('JOB_TYPE_NOT_READY');
  });

  test('API_TOKEN still works with the rate limiter enabled', async () => {
    const knex = createTestDatabase();
    const app = buildApp({
      knex,
      apiToken: 'demo-token',
      config: { ...baseConfig, RATE_LIMIT_PER_MINUTE: 2 }
    });
    await app.ready();
    try {
      const unauthorized = await app.inject('/api/v1/destinations');
      expect(unauthorized.statusCode).toBe(401);
      const authorized = await app.inject({ method: 'GET', url: '/api/v1/destinations', headers: { authorization: 'Bearer demo-token' } });
      expect(authorized.statusCode).toBe(200);
    } finally {
      await app.close();
      await knex.destroy();
    }
  });

  test('job manifest includes ai_generated flag and the storage settings', async () => {
    const destination = await createDestination(ctx, 'discourse', 'normal');
    const created = await postJob(ctx, { type: 'certify', input: { destination_id: destination.id } }, 'manifest-job-3');
    await require('../../src/modules/jobs/worker').runPending(workerDeps(ctx));
    const response = await ctx.app.inject(`/api/v1/jobs/${created.json().job_id}`);
    const manifest = await ctx.app.inject(response.json().links.manifest);
    const payload = manifest.json();
    expect(payload.ai_generated).toBe(false);
    expect(payload.licence_rights.ai_generated).toBe(false);
    expect(payload.settings.storage_driver).toBeTruthy();
  });

  test('download manifest route returns JSON and is linked from the job result', async () => {
    const destination = await createDestination(ctx, 'discourse', 'normal');
    const created = await postJob(ctx, { type: 'certify', input: { destination_id: destination.id } }, 'manifest-job-4');
    await require('../../src/modules/jobs/worker').runPending(workerDeps(ctx));
    const response = await ctx.app.inject(`/api/v1/jobs/${created.json().job_id}`);
    const manifest = await ctx.app.inject(response.json().links.manifest);
    expect(manifest.statusCode).toBe(200);
    expect(manifest.headers['content-type']).toContain('application/json');
  });
});
