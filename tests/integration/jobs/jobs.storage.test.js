/**
 * Verifies durable job output, manifests, input sources, and download routes.
 * The harness uses mock storage so the test suite never needs cloud credentials.
 */
const { runPending } = require('../../../src/modules/jobs/worker');
const { describe } = require('@jest/globals');
const { createContext, resetJobs, createDestination, postJob, workerDeps } = require('./helpers');
const { createMock } = require('../../../src/shared/storage/mock');

describe('job storage and manifests', () => {
  let ctx;
  beforeAll(async () => { ctx = await createContext({ storage: createMock() }); });
  beforeEach(async () => { await resetJobs(ctx); });
  afterAll(async () => { await ctx.close(); });

  test('a completed job stores output and a complete output manifest with download links', async () => {
    const destination = await createDestination(ctx, 'discourse', 'normal');
    const created = await postJob(ctx, { type: 'certify', input: { destination_id: destination.id } }, 'storage-job-1');
    await runPending(workerDeps(ctx));
    const read = await ctx.app.inject(`/api/v1/jobs/${created.json().job_id}`);
    expect(read.json().links).toEqual(expect.objectContaining({ output: expect.any(String), manifest: expect.any(String) }));
    const manifest = await ctx.app.inject(read.json().links.manifest);
    expect(manifest.json()).toEqual(expect.objectContaining({ providers: expect.any(Array), settings: expect.any(Object), seed: expect.any(String), timings: expect.any(Object), cost_estimate: expect.any(Object), warnings: expect.any(Array), licence_rights: expect.any(Object) }));
    expect((await ctx.app.inject(read.json().links.output)).statusCode).toBe(200);
  });

  test('a base64 upload is stored before the queued job is returned', async () => {
    const destination = await createDestination(ctx, 'discourse', 'normal');
    const created = await postJob(ctx, { type: 'certify', input: { destination_id: destination.id, source: { upload: { name: 'input.json', content_base64: Buffer.from('{"demo":true}').toString('base64') } } } }, 'storage-upload-1');
    const job = await ctx.knex('jobs').where({ id: created.json().job_id }).first();
    expect(job.input.source.upload.storage_key).toMatch(/jobs\/.+\/input\/input.json/);
    await expect(ctx.app.storage.get(job.input.source.upload.storage_key)).resolves.toEqual(Buffer.from('{"demo":true}'));
  });

  test('a URL source is accepted and retained without fetching an untrusted URL', async () => {
    const destination = await createDestination(ctx, 'discourse', 'normal');
    const created = await postJob(ctx, { type: 'certify', input: { destination_id: destination.id, source: { url: 'https://example.test/input.json' } } }, 'storage-url-1');
    const job = await ctx.knex('jobs').where({ id: created.json().job_id }).first();
    expect(job.input.source).toEqual({ url: 'https://example.test/input.json' });
  });
});
