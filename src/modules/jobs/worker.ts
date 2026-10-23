/**
 * Claims queued jobs one at a time and records only safe completion data.
 * Tests invoke runPending directly; server.ts alone owns polling timers.
 */
import AppError = require('../../shared/errors/AppError');
import * as repository from './repository';
import types = require('./types');
import { sign } from './callbackSign';
import { buildOutputManifest } from '../manifest/build';

function errorBody(error: any): any {
  if (error instanceof AppError) return { code: error.code, message: error.message, retryable: error.retryable, details: error.details };
  return { code: 'INTERNAL_ERROR', message: 'Job execution failed', retryable: false, details: {} };
}

async function callback(deps: any, job: any, status: string, result: any, error: any): Promise<void> {
  if (!job.callback_url) return;
  const body = JSON.stringify({ job_id: job.id, status, result, error });
  const timestamp = String(Math.floor(Date.now() / 1000));
  try {
    await fetch(job.callback_url, { method: 'POST', body, signal: AbortSignal.timeout(deps.config.JOBS_CALLBACK_TIMEOUT_MS), headers: {
      'content-type': 'application/json', 'X-IncuBrix-Timestamp': timestamp,
      'X-IncuBrix-Signature': sign(deps.config.JOBS_CALLBACK_SECRET, timestamp, body) } });
    await repository.update(deps.knex, job.id, { callback_status: 'delivered' });
  } catch {
    await repository.update(deps.knex, job.id, { callback_status: 'failed' });
    deps.logger.warn({ job_id: job.id, correlation_id: job.correlation_id }, 'Job callback failed');
  }
}

async function process(deps: any, job: any): Promise<void> {
  const logger = deps.logger.child({ job_id: job.id, correlation_id: job.correlation_id });
  const progress = async (value: number) => repository.update(deps.knex, job.id, { progress: value });
  const startedAt = Date.now();
  try {
    const result = await types[job.type]({ ...deps, logger }, job.input, progress);
    const outputKey = `jobs/${job.id}/output.json`;
    const manifestKey = `jobs/${job.id}/manifest.json`;
    const manifest = buildOutputManifest(deps.config, startedAt);
    await deps.storage.put(outputKey, JSON.stringify(result));
    await deps.storage.put(manifestKey, JSON.stringify(manifest));
    const stored = { ...result, output_key: outputKey, manifest_key: manifestKey };
    await repository.update(deps.knex, job.id, { status: 'succeeded', progress: 100, result: stored, finished_at: new Date() });
    await callback(deps, job, 'succeeded', stored, null);
    logger.info('Job succeeded');
  } catch (error) {
    const safe = errorBody(error);
    await repository.update(deps.knex, job.id, { status: 'failed', error: safe, finished_at: new Date() });
    await callback(deps, job, 'failed', null, safe);
    logger.warn({ code: safe.code }, 'Job failed');
  }
}

async function runPending(deps: any): Promise<number> {
  let count = 0;
  let job = await repository.claim(deps.knex);
  while (job) { await process(deps, job); count += 1; job = await repository.claim(deps.knex); }
  return count;
}

export { runPending };
