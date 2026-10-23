/**
 * Creates, reads and formats jobs while enforcing the public API contract.
 * Queue execution lives in worker.ts so HTTP calls never perform job work.
 */
import AppError = require('../../shared/errors/AppError');
import * as repository from './repository';
import types = require('./types');

function validCallback(url: any): boolean {
  return !url || (typeof url === 'string' && /^https?:\/\//.test(url));
}

function validSource(source: any): boolean {
  if (!source) return true;
  if (typeof source.url === 'string') return /^https?:\/\//.test(source.url);
  return Boolean(source.upload && typeof source.upload.name === 'string' && typeof source.upload.content_base64 === 'string');
}

async function persistInput(storage: any, knex: any, job: any): Promise<any> {
  const source = job.input.source;
  if (!source || !source.upload) return job;
  const name = source.upload.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `jobs/${job.id}/input/${name}`;
  await storage.put(key, Buffer.from(source.upload.content_base64, 'base64'));
  const input = { ...job.input, source: { upload: { name, storage_key: key } } };
  return repository.update(knex, job.id, { input });
}

async function create(deps: any, input: any, correlationId: string): Promise<any> {
  if (!types[input.type]) throw new AppError('JOB_TYPE_UNKNOWN', 'Job type is not supported', { statusCode: 400 });
  if (!input.input || typeof input.input !== 'object' || !validCallback(input.callback_url) || !validSource(input.input.source)) {
    throw new AppError('VALIDATION_ERROR', 'Job request is not valid', { statusCode: 400 });
  }
  const job = await repository.insert(deps.knex, {
    type: input.type,
    status: 'queued',
    progress: 0,
    input: input.input,
    callback_url: input.callback_url || null,
    correlation_id: correlationId
  });
  return persistInput(deps.storage, deps.knex, job);
}

function links(job: any): any {
  const output = job.result?.output_key ? `/api/v1/jobs/${job.id}/download/output` : null;
  const manifest = job.result?.manifest_key ? `/api/v1/jobs/${job.id}/download/manifest` : null;
  if (!job.result || !job.result.run_id) return { output, manifest };
  const run = `/api/v1/certification/runs/${job.result.run_id}`;
  return { run, evidence: `${run}/evidence`, output, manifest };
}

async function get(knex: any, id: string): Promise<any> {
  const job = await repository.findById(knex, id);
  if (!job) throw new AppError('NOT_FOUND', 'Job not found', { statusCode: 404 });
  return { job_id: job.id, type: job.type, status: job.status, progress: job.progress, result: job.result,
    error: job.error, links: links(job), created_at: job.created_at, started_at: job.started_at, finished_at: job.finished_at };
}

async function download(deps: any, id: string, kind: string): Promise<Buffer> {
  const job = await repository.findById(deps.knex, id);
  if (!job) throw new AppError('NOT_FOUND', 'Job not found', { statusCode: 404 });
  const key = kind === 'manifest' ? job.result?.manifest_key : job.result?.output_key;
  if (!key) throw new AppError('NOT_FOUND', 'Job output not found', { statusCode: 404 });
  try { return await deps.storage.get(key); }
  catch { throw new AppError('NOT_FOUND', 'Job output not found', { statusCode: 404 }); }
}

export { create, get, download };
