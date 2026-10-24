/**
 * Verifies the remaining Integration Standard API workflows without external platform keys.
 * Jobs are processed against the in-process test database and local connector mocks.
 */
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { afterAll, beforeAll, beforeEach, describe, expect, test } = require('@jest/globals');
const { runPending } = require('../../src/modules/jobs/worker');
const { createContext, resetJobs, createDestination, jobPayload, workerDeps } = require('./jobs/helpers');
const { runBatch } = require('../../dist/scripts/ix-batch');

describe('Phase 3 Integration Standard', () => {
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

  test('ix-batch writes summary.json and one result per input', async () => {
    const batchCtx = await createContext({ apiToken: 'fake-test-token' });
    const input = await fs.mkdtemp(path.join(os.tmpdir(), 'ix-batch-input-'));
    const destination = await createDestination(batchCtx, 'discourse', 'normal');
    const output = path.join(batchCtx.directory, 'batch-output');
    await fs.writeFile(path.join(input, 'success.json'), JSON.stringify(jobPayload(destination.id)));
    await fs.writeFile(path.join(input, 'rejected.json'), JSON.stringify({ type: 'missing', input: {} }));

    let active = true;
    const worker = (async () => {
      while (active) {
        await runPending(workerDeps(batchCtx));
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    })();

    try {
      const summary = await runBatch({
        input,
        out: output,
        api: `http://127.0.0.1:${batchCtx.port}`,
        token: 'fake-test-token'
      });
      expect(summary).toEqual(expect.objectContaining({ total: 2, passed: 1, failed: 1 }));
      expect(summary.results).toHaveLength(2);
      const outputFiles = await fs.readdir(output);
      expect(outputFiles.filter((name) => name.endsWith('-manifest.json'))).toHaveLength(1);
      expect(outputFiles.filter((name) => /^\d{3}-(success|rejected)\.json$/.test(name))).toHaveLength(2);
      expect(outputFiles).toContain('summary.json');
      expect(JSON.parse(await fs.readFile(path.join(output, 'summary.json'), 'utf8')).total).toBe(2);
    } finally {
      active = false;
      await worker;
      await fs.rm(input, { recursive: true, force: true });
      await batchCtx.close();
    }
  });

  test('ix-batch loads the eight hard-case sample inputs', async () => {
    const input = path.join(process.cwd(), 'samples', 'batch');
    const files = await fs.readdir(input);
    const cases = await Promise.all(files.filter((name) => name.endsWith('.json')).map(async (name) => {
      const sample = JSON.parse(await fs.readFile(path.join(input, name), 'utf8'));
      return sample.input.case;
    }));
    expect(files.filter((name) => name.endsWith('.json'))).toHaveLength(8);
    expect(cases).toEqual(expect.arrayContaining([
      'expired_token',
      'rate_limited',
      'spec_violation',
      'frequency_cap',
      'no_promo_forum'
    ]));
  });

  test('ix-batch accepts a single JSON input file', async () => {
    const input = path.join(ctx.directory, 'single-input.json');
    const output = path.join(ctx.directory, 'single-output');
    await fs.writeFile(input, JSON.stringify({ type: 'unknown', input: {} }));

    const summary = await runBatch({ input, out: output, api: `http://127.0.0.1:${ctx.port}` });

    expect(summary).toEqual(expect.objectContaining({ total: 1, passed: 0, failed: 1 }));
    expect(await fs.readdir(output)).toEqual(expect.arrayContaining(['001-single-input.json', 'summary.json']));
  });

  test('E2E full path with no API keys', async () => {
    const baseUrl = `${ctx.mockRoot}/discourse/normal`;
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/destinations',
      headers: { 'idempotency-key': 'phase3-e2e-destination' },
      payload: {
        name: 'In-process Discourse',
        url: baseUrl,
        platform_key: 'discourse',
        connector_key: 'discourse',
        language: 'en',
        config: { base_url: baseUrl }
      }
    });
    expect(created.statusCode).toBe(201);
    const destination = created.json();
    const connection = { api_key: 'fake-test-key', api_username: 'test-user' };
    const published = await ctx.app.inject({
      method: 'POST',
      url: '/connector/v1/discourse/publish',
      headers: { 'idempotency-key': 'phase3-e2e-publish' },
      payload: {
        destination_id: destination.id,
        connection,
        rendition: { title: 'A sufficiently long title', body: 'A helpful test post.' }
      }
    });
    expect(published.statusCode).toBe(200);
    const platformPostId = published.json().platform_post_id;

    const status = await ctx.app.inject({
      method: 'POST',
      url: '/connector/v1/discourse/get_status',
      payload: { destination_id: destination.id, connection, platform_post_id: platformPostId }
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().status).toBe('published');

    const deleted = await ctx.app.inject({
      method: 'POST',
      url: '/connector/v1/discourse/delete',
      payload: { destination_id: destination.id, connection, platform_post_id: platformPostId }
    });
    expect(deleted.statusCode).toBe(200);

    const createdJob = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/jobs',
      headers: { 'idempotency-key': 'phase3-e2e-certify' },
      payload: jobPayload(destination.id)
    });
    expect(createdJob.statusCode).toBe(202);
    await runPending(workerDeps(ctx));
    const jobId = createdJob.json().job_id;
    const job = await ctx.app.inject({ method: 'GET', url: `/api/v1/jobs/${jobId}` });
    expect(job.json()).toEqual(expect.objectContaining({ status: 'succeeded', progress: 100 }));
    expect(job.json().links.manifest).toBe(`/api/v1/jobs/${jobId}/download/manifest`);

    const manifest = await ctx.app.inject({ method: 'GET', url: job.json().links.manifest });
    expect(manifest.statusCode).toBe(200);
    expect(JSON.parse(manifest.body)).toEqual(expect.objectContaining({
      providers: expect.any(Array),
      timings: expect.any(Object),
      cost_estimate: expect.any(Object)
    }));
  });

  test('.env.example lists every config setting', async () => {
    const configPath = path.join(process.cwd(), 'src/config/index.ts');
    const envPath = path.join(process.cwd(), '.env.example');
    const configSource = await fs.readFile(configPath, 'utf8');
    const envExample = await fs.readFile(envPath, 'utf8');
    const configInterface = configSource.match(/interface AppConfig\s*\{([\s\S]*?)\n\}/);
    expect(configInterface).not.toBeNull();
    const settings = [...configInterface[1].matchAll(/^\s*([A-Z][A-Z0-9_]+):/gm)].map((match) => match[1]);
    const documented = new Set([...envExample.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]));
    expect(settings.filter((setting) => !documented.has(setting))).toEqual([]);
  });
});
