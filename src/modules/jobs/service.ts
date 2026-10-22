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

async function create(deps: any, input: any, correlationId: string): Promise<any> {
  if (!types[input.type]) throw new AppError('JOB_TYPE_UNKNOWN', 'Job type is not supported', { statusCode: 400 });
  if (!input.input || typeof input.input !== 'object' || !validCallback(input.callback_url)) {
    throw new AppError('VALIDATION_ERROR', 'Job request is not valid', { statusCode: 400 });
  }
  return repository.insert(deps.knex, {
    type: input.type,
    status: 'queued',
    progress: 0,
    input: input.input,
    callback_url: input.callback_url || null,
    correlation_id: correlationId
  });
}

function links(job: any): any {
  if (!job.result || !job.result.run_id) return {};
  const run = `/api/v1/certification/runs/${job.result.run_id}`;
  return { run, evidence: `${run}/evidence` };
}

async function get(knex: any, id: string): Promise<any> {
  const job = await repository.findById(knex, id);
  if (!job) throw new AppError('NOT_FOUND', 'Job not found', { statusCode: 404 });
  return { job_id: job.id, type: job.type, status: job.status, progress: job.progress, result: job.result,
    error: job.error, links: links(job), created_at: job.created_at, started_at: job.started_at, finished_at: job.finished_at };
}

export { create, get };
