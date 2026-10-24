/**
 * Exercises catalogue intake, deduplication, enrichment, language detection,
 * row-level failures, stored CSV reports, and the 1,000-row performance target.
 */
const fs = require('fs/promises');
const path = require('path');
const { createContext } = require('../certification/helpers');
const { runPending } = require('../../../src/modules/jobs/worker');
const { workerDeps } = require('../jobs/helpers');
const { mapConcurrent } = require('../../../src/modules/catalogue/service');
const { parseRecords } = require('../../../src/modules/catalogue/csv');
const { describe } = require('@jest/globals');

const HEADERS = 'name,url,platform_key,connector_key,category,description,audience_tags';

function row(name, url, platform = 'forum', extra = '') {
  const description = extra || 'The community shares ideas and resources';
  return `${name},${url},${platform},discourse,creators,${description},creators`;
}

function csv(rows) {
  return `${HEADERS}\r\n${rows.join('\r\n')}\r\n`;
}

async function submit(ctx, content, key = 'catalogue-import') {
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/v1/catalogue/import',
    headers: { 'idempotency-key': key },
    payload: {
      source: {
        upload: {
          name: 'catalogue.csv',
          content_base64: Buffer.from(content).toString('base64')
        }
      }
    }
  });
  return response;
}

async function execute(ctx, content, key) {
  const accepted = await submit(ctx, content, key);
  expect(accepted.statusCode).toBe(202);
  await runPending(workerDeps(ctx));
  const job = await ctx.app.inject(`/api/v1/jobs/${accepted.json().job_id}`);
  return { job: job.json(), accepted: accepted.json() };
}

describe('catalogue imports', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await createContext({
      catalogueOptions: {
        reachability: async () => true,
        enrich: async () => 1234,
        fetcher: async () => new Response(csv([row('URL source', 'https://example.com/url-source')]))
      }
    });
  });

  beforeEach(async () => {
    await ctx.knex.raw('TRUNCATE jobs, idempotency_keys, destinations CASCADE');
  });

  afterAll(async () => {
    await ctx.close();
  });

  test('import dedupes on normalised url plus platform', async () => {
    const content = csv([
      row('First', 'HTTPS://Example.COM/community/'),
      row('Duplicate', 'https://example.com/community'),
      row('Other platform', 'https://example.com/community', 'another-forum')
    ]);
    const { job } = await execute(ctx, content, 'catalogue-dedupe');
    expect(job.status).toBe('succeeded');
    expect(job.result).toEqual(expect.objectContaining({ rows: 3, imported: 2, duplicates: 1 }));
  });

  test('import reports bad urls row by row', async () => {
    const content = csv([
      row('Bad scheme', 'ftp://example.com/community'),
      row('Private host', 'http://127.0.0.1/private'),
      row('Good row', 'https://example.com/good')
    ]);
    const { job } = await execute(ctx, content, 'catalogue-bad-urls');
    expect(job.result.error_rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, code: 'VALIDATION_ERROR' }),
      expect.objectContaining({ row: 3, code: 'VALIDATION_ERROR' })
    ]));
    expect(job.result.imported).toBe(1);
  });

  test('import handles mixed languages', async () => {
    const content = csv([
      row(
        'English group',
        'https://example.com/english',
        'forum',
        'The community shares ideas and resources'
      ),
      row(
        'Grupo español',
        'https://example.com/espanol',
        'forum',
        'La comunidad comparte ideas para creadores'
      ),
      row(
        'Groupe français',
        'https://example.com/francais',
        'forum',
        'La communauté partage des idées pour les créateurs'
      )
    ]);
    const { job } = await execute(ctx, content, 'catalogue-languages');
    const rows = await ctx.knex('destinations').select('language').orderBy('name');
    expect(job.result.imported).toBe(3);
    expect(rows.map((item) => item.language)).toEqual(expect.arrayContaining(['en', 'es', 'fr']));
  });

  test('import error csv is stored and linked', async () => {
    const { job } = await execute(
      ctx,
      csv([row('Bad URL', 'ftp://example.com/nope')]),
      'catalogue-error-link'
    );
    expect(job.links.errors).toBe(`/api/v1/jobs/${job.job_id}/download/errors`);
    await expect(ctx.app.storage.exists(job.result.errors_key)).resolves.toBe(true);
    const response = await ctx.app.inject(job.links.errors);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.body).toContain('VALIDATION_ERROR');
  });

  test('1000 row import finishes under 5 minutes', async () => {
    const fixture = await fs.readFile(
      path.resolve(process.cwd(), 'samples/catalogue/catalogue-1000.csv'),
      'utf8'
    );
    const started = Date.now();
    const { job } = await execute(ctx, fixture, 'catalogue-1000');
    const seconds = (Date.now() - started) / 1000;
    expect(job.status).toBe('succeeded');
    expect(job.result.rows).toBe(1000);
    expect(seconds).toBeLessThan(300);
  });

  test('selftest csv case now runs for real', async () => {
    const content = csv([
      row('Self test English', 'https://example.com/selftest-catalogue'),
      row('Normalized duplicate', 'https://example.com/selftest-catalogue/'),
      row('Bad URL', 'ftp://example.com/selftest-invalid'),
      row('Grupo español', 'https://example.com/selftest-es', 'forum', 'La comunidad comparte ideas')
    ]);
    try {
      const { job } = await execute(ctx, content, 'selftest-csv-case');
      expect(job.status).toBe('succeeded');
      expect(job.result).toEqual(expect.objectContaining({
        rows: 4,
        imported: 2,
        duplicates: 1,
        errors: 2
      }));
      expect(job.result.languages).toContain('es');
    } finally {
      await ctx.knex('destinations').where({ platform_key: 'forum' })
        .whereIn('url', ['https://example.com/selftest-catalogue', 'https://example.com/selftest-es'])
        .del();
    }
  });

  test('quoted CSV fields preserve commas and UTF-8', () => {
    const record = [
      '"Comunidad, creadores"',
      'https://example.com/utf8',
      'forum',
      'discourse',
      'creators',
      '"La comunidad comparte ideas"',
      'creators'
    ].join(',');
    const parsed = parseRecords(`${HEADERS}\r\n${record}\r\n`);
    expect(parsed[0].name).toBe('Comunidad, creadores');
    expect(parsed[0].description).toContain('comunidad');
  });

  test('catalogue import fetches and stores URL-sourced CSV', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/catalogue/import',
      headers: { 'idempotency-key': 'catalogue-url-source' },
      payload: { source: { url: 'https://example.com/catalogue.csv' } }
    });
    expect(response.statusCode).toBe(202);
    const saved = await ctx.knex('jobs').where({ id: response.json().job_id }).first();
    expect(saved.input.source.upload.storage_key).toMatch(/jobs\/.+\/input\/catalogue\.csv/);
    await expect(ctx.app.storage.exists(saved.input.source.upload.storage_key)).resolves.toBe(true);
  });

  test('unsupported CSV columns are rejected before enqueue', async () => {
    const privateHeaderCsv = 'name,url,platform_key,connector_key,api_key\r\n' +
      'A,https://example.com/a,forum,discourse,fake-secret\r\n';
    const response = await submit(ctx, privateHeaderCsv, 'catalogue-secret-header');
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    await expect(ctx.knex('jobs').count('* as count').first()).resolves.toMatchObject({ count: '0' });
  });

  test('reachability checks run with concurrency 50', async () => {
    let active = 0;
    let maximum = 0;
    await mapConcurrent(Array.from({ length: 100 }, (_, index) => index), 50, async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
    });
    expect(maximum).toBe(50);
  });

  test('mock enrichment and relevance are saved on imported destinations', async () => {
    const content = csv([
      row(
        'AI marketing community',
        'https://example.com/relevance',
        'forum',
        'AI marketing for SaaS founders'
      )
    ]);
    await execute(ctx, content, 'catalogue-enrichment');
    const destination = await ctx.knex('destinations')
      .where({ url: 'https://example.com/relevance' })
      .first();
    expect(destination.est_audience).toBe(1234);
    expect(destination.relevance_score).toBeGreaterThanOrEqual(1);
    expect(destination.relevance_score).toBeLessThanOrEqual(5);
    expect(destination.relevance_reason).toContain('/5');
  });
});
