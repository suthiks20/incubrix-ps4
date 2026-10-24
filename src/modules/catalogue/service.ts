/**
 * Imports destination rows with normalization, duplicate protection, enrichment,
 * relevance scoring, and a stored CSV report for every rejected row.
 */
import AppError = require('../../shared/errors/AppError');
import normalizeUrl = require('../destinations/commons/normalizeUrl');
import { parseRecords, formatErrorCsv } from './csv';
import { detectLanguage } from './language';
import tailoring = require('../tailoring');
import * as repository from './repository';

interface Candidate {
  rowNumber: number;
  source: Record<string, string>;
  destination: Record<string, any>;
  key: string;
}

function errorRow(rowNumber: number, row: any, code: string, message: string): any {
  let safeUrl = '[invalid URL]';
  try {
    const url = new URL(row.url || '');
    url.username = '';
    url.password = '';
    url.search = '';
    safeUrl = url.toString();
  } catch {
    safeUrl = '[invalid URL]';
  }
  return {
    row: rowNumber,
    name: row.name || '',
    url: safeUrl,
    platform_key: row.platform_key || '',
    code,
    message
  };
}

function parseOptionalJson(value: string, fallback: any): any {
  if (!value) return fallback;
  return JSON.parse(value);
}

function parseBoolean(value: string, fallback: boolean): boolean {
  if (!value) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('Expected true or false');
}

function publicHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('URL is not valid');
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const localHost = host === 'localhost' || host.endsWith('.localhost') ||
    host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.test') ||
    host.endsWith('.invalid') || !host.includes('.');
  const ipLiteral = /^\[?[\da-f:.]+\]?$/i.test(host);
  const credentialQuery = [...url.searchParams.keys()].some((key) =>
    /token|api[_-]?key|secret|password|credential|authorization|signature/i.test(key)
  );
  if (!['http:', 'https:'].includes(url.protocol) || !host || localHost || ipLiteral ||
    url.username || url.password || credentialQuery) {
    throw new Error('URL must be a public HTTP or HTTPS address');
  }
  return url;
}

function makeDestination(
  row: Record<string, string>,
  url: URL,
  normalized: string,
  platformKey: string
): any {
  const language = row.language || detectLanguage(
    `${row.name} ${row.category || ''} ${row.description || ''} ${row.audience_tags || ''}`
  );
  const tags = (row.audience_tags || '').split(/[;|]/).map((tag) => tag.trim()).filter(Boolean);
  const relevance = tailoring.scoreRelevance({
    title: row.name,
    body: `${row.category || ''} ${row.description || ''}`,
    tags
  });
  const destination: Record<string, any> = {
    name: row.name,
    url: url.toString(),
    url_normalized: normalized,
    platform_key: platformKey,
    connector_key: row.connector_key.toLowerCase(),
    surface: row.surface || 'default',
    category: row.category || null,
    audience_tags: tags,
    language,
    geo: row.geo || null,
    est_audience: row.est_audience ? Number(row.est_audience) : null,
    rules_url: row.rules_url ? publicHttpUrl(row.rules_url).toString() : null,
    frequency_cap: parseOptionalJson(row.frequency_cap, null),
    self_promo_allowed: parseBoolean(row.self_promo_allowed, false),
    link_policy: row.link_policy || 'allowed',
    disclosure_required: parseBoolean(row.disclosure_required, false),
    automation_allowed: parseBoolean(row.automation_allowed, true),
    config: {},
    connection_ref: null,
    relevance_score: relevance.relevance_score,
    relevance_reason: relevance.relevance_reason
  };
  if (destination.est_audience !== null && !Number.isInteger(destination.est_audience)) {
    throw new Error('est_audience must be an integer');
  }
  return destination;
}

function makeCandidate(row: Record<string, string>, rowNumber: number): Candidate {
  if (!row.name || !row.url || !row.platform_key || !row.connector_key) {
    throw new Error('name, url, platform_key and connector_key are required');
  }
  const url = publicHttpUrl(row.url);
  const normalized = normalizeUrl(url.toString());
  const platformKey = row.platform_key.toLowerCase();
  const destination = makeDestination(row, url, normalized, platformKey);
  return { rowNumber, source: row, destination, key: `${platformKey}\n${normalized}` };
}

async function mapConcurrent<T>(
  values: T[],
  limit: number,
  work: (value: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (next < values.length) {
      const index = next;
      next += 1;
      await work(values[index], index);
    }
  });
  await Promise.all(workers);
}

async function defaultReachability(url: string): Promise<boolean> {
  const response = await fetch(url, {
    method: 'HEAD',
    redirect: 'manual',
    signal: AbortSignal.timeout(1500)
  });
  return response.ok;
}

function mockMemberCount(row: Record<string, string>): number {
  if (row.est_audience) return Number(row.est_audience);
  return 100 + [...row.url].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 90000;
}

async function loadRows(storage: any, input: any): Promise<Record<string, string>[]> {
  const key = input?.source?.upload?.storage_key;
  if (!key) throw new AppError('VALIDATION_ERROR', 'Catalogue CSV input is missing', { statusCode: 400 });
  const csv = (await storage.get(key)).toString('utf8');
  try {
    const rows = parseRecords(csv);
    if (rows.length) return rows;
  } catch (error: any) {
    throw new AppError('VALIDATION_ERROR', 'Catalogue CSV is invalid', {
      statusCode: 400,
      details: { reason: error.message }
    });
  }
  throw new AppError('VALIDATION_ERROR', 'Catalogue CSV has no data rows', { statusCode: 400 });
}

function buildCandidates(rows: Record<string, string>[], errors: any[]): Candidate[] {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < rows.length; index += 1) {
    try {
      const candidate = makeCandidate(rows[index], index + 2);
      if (seen.has(candidate.key)) {
        errors.push(errorRow(
          candidate.rowNumber,
          candidate.source,
          'DUPLICATE_DESTINATION',
          'Duplicate in CSV'
        ));
      } else {
        seen.add(candidate.key);
        candidates.push(candidate);
      }
    } catch (error: any) {
      errors.push(errorRow(index + 2, rows[index], 'VALIDATION_ERROR', error.message));
    }
  }
  return candidates;
}

async function removeExisting(
  knex: any,
  candidates: Candidate[],
  errors: any[]
): Promise<Candidate[]> {
  const existing = await repository.findExistingPairs(
    knex,
    candidates.map((candidate): [string, string] => [
      candidate.destination.platform_key,
      candidate.destination.url_normalized
    ])
  );
  const existingKeys = new Set(existing.map((row) => `${row.platform_key}\n${row.url_normalized}`));
  const ready = candidates.filter((candidate) => {
    if (!existingKeys.has(candidate.key)) return true;
    errors.push(errorRow(
      candidate.rowNumber,
      candidate.source,
      'DUPLICATE_DESTINATION',
      'Destination already exists'
    ));
    return false;
  });
  return ready;
}

async function checkReachability(
  candidates: Candidate[],
  options: any,
  errors: any[]
): Promise<Candidate[]> {
  const reachable: Candidate[] = [];
  await mapConcurrent(candidates, 50, async (candidate) => {
    try {
      const check = options.reachability || defaultReachability;
      if (!await check(candidate.destination.url)) {
        errors.push(errorRow(
          candidate.rowNumber,
          candidate.source,
          'PLATFORM_UNAVAILABLE',
          'Destination did not respond'
        ));
        return;
      }
    } catch {
      errors.push(errorRow(
        candidate.rowNumber,
        candidate.source,
        'PLATFORM_UNAVAILABLE',
        'Reachability check failed'
      ));
      return;
    }
    try {
      const enrich = options.enrich || mockMemberCount;
      candidate.destination.est_audience = await enrich(candidate.source);
      reachable.push(candidate);
    } catch {
      errors.push(errorRow(
        candidate.rowNumber,
        candidate.source,
        'PLATFORM_UNAVAILABLE',
        'Member-count enrichment failed'
      ));
    }
  });
  return reachable;
}

async function saveCandidates(knex: any, candidates: Candidate[], errors: any[]): Promise<number> {
  let imported = 0;
  for (const candidate of candidates) {
    try {
      await repository.insert(knex, candidate.destination);
      imported += 1;
    } catch (error: any) {
      const duplicate = error.code === '23505';
      errors.push(errorRow(candidate.rowNumber, candidate.source,
        duplicate ? 'DUPLICATE_DESTINATION' : 'INTERNAL_ERROR',
        duplicate ? 'Destination already exists' : 'Destination could not be saved'));
    }
  }
  return imported;
}

function languages(rows: Record<string, string>[]): string[] {
  return [...new Set(rows.map((row) => row.language || detectLanguage(
    `${row.name} ${row.category || ''} ${row.description || ''} ${row.audience_tags || ''}`
  )))];
}

async function importCatalogue(
  deps: any,
  input: any,
  progress: (value: number) => Promise<void>
): Promise<any> {
  const rows = await loadRows(deps.storage, input);
  await progress(10);
  const errors: any[] = [];
  const candidates = buildCandidates(rows, errors);
  const ready = await removeExisting(deps.knex, candidates, errors);
  await progress(25);
  const reachable = await checkReachability(ready, deps.catalogueOptions || {}, errors);
  await progress(70);
  const imported = await saveCandidates(deps.knex, reachable, errors);
  errors.sort((left, right) => left.row - right.row);
  const errorKey = `jobs/${deps.job_id}/catalogue-errors.csv`;
  await deps.storage.put(errorKey, formatErrorCsv(errors));
  await progress(100);
  return {
    rows: rows.length,
    imported,
    duplicates: errors.filter((row) => row.code === 'DUPLICATE_DESTINATION').length,
    errors: errors.length,
    languages: languages(rows),
    error_count: errors.length,
    errors_key: errorKey,
    error_csv_link: `/api/v1/jobs/${deps.job_id}/download/errors`,
    error_rows: errors
  };
}

export { importCatalogue, publicHttpUrl, makeCandidate, mapConcurrent };
