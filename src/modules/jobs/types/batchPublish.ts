/**
 * Executes simulation-only batch items through the shared connector contract.
 * Every created post is deleted before the job report is returned.
 */
import AppError = require('../../../shared/errors/AppError');
import registry = require('../../connectors/registry');
import contract = require('../../connectors/services/contract');
import { resolveConnection } from '../../../shared/connections/resolve';
import { markerFor } from '../../connectors/commons/marker';

function safeDestination(deps: any, item: any): Promise<any> {
  const value = item.destination || item.destination_id;
  if (typeof value !== 'string') {
    throw new AppError('VALIDATION_ERROR', 'Each batch item needs a destination', { statusCode: 400 });
  }
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  return deps.knex('destinations').where(isId ? { id: value } : { name: value }).first();
}

function scenarioDestination(destination: any, scenario: string): any {
  if (!scenario) return destination;
  if (!/^[a-z0-9_-]+$/i.test(scenario)) {
    throw new AppError('VALIDATION_ERROR', 'Batch mock scenario is invalid', { statusCode: 400 });
  }
  const config = { ...destination.config };
  const base = new URL(config.base_url);
  const parts = base.pathname.split('/');
  parts[parts.length - 1] = scenario;
  base.pathname = parts.join('/');
  config.base_url = base.toString().replace(/\/$/, '');
  return { ...destination, config };
}

function itemConnection(destination: any, config: any): any {
  return resolveConnection(destination, config);
}

async function publish(deps: any, item: any, destination: any, key: string): Promise<any> {
  return contract.execute(
    deps.app,
    destination.connector_key,
    'publish',
    {
      destination,
      connection: itemConnection(destination, deps.config),
      rendition: item.rendition
    },
    key
  );
}

async function removePost(deps: any, destination: any, key: string): Promise<void> {
  const entry = registry.get(destination.connector_key);
  if (!entry) throw new AppError('NOT_FOUND', 'Batch connector is unavailable', { statusCode: 404 });
  const connector = deps.connectorFactory
    ? deps.connectorFactory(entry)
    : entry.createConnector({ config: deps.config, logger: deps.logger });
  const connection = itemConnection(destination, deps.config);
  const post = await connector.findByMarker(destination, connection, markerFor(key));
  if (post) await connector.delete(destination, connection, post.platform_post_id);
}

async function primeFrequencyCap(deps: any, destination: any, key: string): Promise<void> {
  const rendition = { title: 'Batch frequency cap baseline', body: 'Temporary test post.' };
  try {
    await contract.execute(deps.app, destination.connector_key, 'publish', {
      destination,
      connection: itemConnection(destination, deps.config),
      rendition
    }, key);
  } finally {
    await removePost(deps, destination, key);
  }
}

function resultFor(item: any, index: number, outcome: string, code: string, message: string, liveUrl?: string): any {
  return {
    item: { case: item.case || `item-${index + 1}`, destination: item.destination || item.destination_id },
    outcome,
    code,
    message,
    ...(liveUrl ? { live_url: liveUrl } : {}),
    expected: item.expected || {},
    passed: item.expected?.outcome === outcome && item.expected?.code === code
  };
}

async function runItem(deps: any, item: any, index: number, jobId: string): Promise<any> {
  const stored = await safeDestination(deps, item);
  if (!stored || !stored.config?.simulation || !deps.config.SIMULATION_MODE) {
    throw new AppError('VALIDATION_ERROR', 'Batch publishing is restricted to seeded simulations', {
      statusCode: 400,
      details: { item: index + 1 }
    });
  }
  const destination = scenarioDestination(stored, item.mock_scenario);
  const key = `batch-${jobId}-${index + 1}-${item.idempotency_key || 'item'}`;
  const baselineKey = `${key}-cap-baseline`;
  if (stored.name === 'sim-weekly-cap') await primeFrequencyCap(deps, destination, baselineKey);
  let publishResult: any;
  let initialCode = 'OK';
  let message = 'Published test post and removed it.';
  try {
    try {
      publishResult = await publish(deps, item, destination, key);
    } catch (error: any) {
      if (item.retry === 'timeout' && error.code === 'PLATFORM_UNAVAILABLE') {
        initialCode = error.code;
        message = 'Timeout was reconciled by retrying the same idempotency key.';
        publishResult = await publish(deps, item, destination, key);
      } else {
        throw error;
      }
    }
    const code = initialCode;
    return resultFor(item, index, 'published', code, message, publishResult.live_url);
  } catch (error: any) {
    const code = error.code || 'INTERNAL_ERROR';
    const outcome = code === 'DEST_RULE_FREQUENCY_CAP' ? 'rescheduled'
      : code === 'DEST_RULE_VIOLATION' ? 'blocked' : 'failed';
    return resultFor(item, index, outcome, code, error.message || 'Batch item failed');
  } finally {
    await removePost(deps, destination, key);
    if (stored.name === 'sim-weekly-cap') await removePost(deps, destination, baselineKey);
    await deps.knex('publish_ledger').where({
      connector_key: destination.connector_key,
      idempotency_key: key
    }).del();
    await deps.knex('publish_ledger').where({
      connector_key: destination.connector_key,
      idempotency_key: baselineKey
    }).del();
  }
}

async function batchPublish(deps: any, input: any, progress: (value: number) => Promise<void>): Promise<any> {
  if (!Array.isArray(input?.items) || input.items.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'batch_publish requires a non-empty items array', {
      statusCode: 400,
      details: { field: 'items' }
    });
  }
  const results = [];
  for (let index = 0; index < input.items.length; index += 1) {
    results.push(await runItem(deps, input.items[index], index, deps.job_id));
    await progress(Math.floor(((index + 1) / input.items.length) * 95));
  }
  const reportKey = `jobs/${deps.job_id}/report.json`;
  const report = { total: results.length, passed: results.filter((item: any) => item.passed).length, items: results };
  await deps.storage.put(reportKey, JSON.stringify(report));
  return { ...report, report_key: reportKey };
}

export = batchPublish;
