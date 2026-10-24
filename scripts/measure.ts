/**
 * Builds evidence-backed metrics from saved certification and catalogue records.
 * Runs disposable mock publications and forced timeout retries to measure safety and cleanup.
 */
import fs from 'fs';
import path from 'path';
import rules = require('../src/modules/rules/engine');
import { markerFor } from '../src/modules/connectors/commons/marker';

const connectorKeys = [
  'discourse', 'lemmy', 'devto', 'ghost', 'webhook', 'assisted', 'mrss', 'slack', 'hashnode'
];
const publishCore = ['discourse', 'lemmy', 'devto', 'ghost', 'webhook'];
const ruleGroups: Record<string, string[]> = {
  frequency_cap: ['DEST_RULE_FREQUENCY_CAP'],
  no_promo: ['SELF_PROMOTION_NOT_ALLOWED'],
  link_policy: ['LINK_POLICY_VIOLATION'],
  ai_disclosure: ['AI_DISCLOSURE_APPENDED', 'AI_DISCLOSURE_UNKNOWN']
};

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function calculateRuleMetrics(cases: any[]): any {
  if (cases.length < 20) throw new Error('The rule fixture must contain at least 20 cases');
  const byRule: any = {};
  for (const name of Object.keys(ruleGroups)) {
    byRule[name] = { expected: 0, caught: 0, missed: 0 };
  }
  let expectedTotal = 0;
  let caughtTotal = 0;
  let missedTotal = 0;
  for (const item of cases) {
    const actual = rules.evaluate(item.input);
    const actualCodes = actual.reasons.map((reason: any) => reason.code);
    for (const [name, codes] of Object.entries(ruleGroups)) {
      const expectedCodes = item.expect.codes.filter((code: string) => codes.includes(code));
      byRule[name].expected += expectedCodes.length;
      byRule[name].missed += expectedCodes.filter((code: string) => !actualCodes.includes(code)).length;
      byRule[name].caught += expectedCodes.filter((code: string) => actualCodes.includes(code)).length;
      expectedTotal += expectedCodes.length;
      caughtTotal += expectedCodes.filter((code: string) => actualCodes.includes(code)).length;
      missedTotal += expectedCodes.filter((code: string) => !actualCodes.includes(code)).length;
    }
  }
  for (const [name, metrics] of Object.entries(byRule)) {
    if (!(metrics as any).expected) throw new Error(`The rule fixture has no ${name} cases`);
  }
  return {
    fixture: 'tests/fixtures/rule-cases.json',
    cases: cases.length,
    violations_expected: expectedTotal,
    violations_caught: caughtTotal,
    violations_missed: missedTotal,
    by_rule: byRule
  };
}

function calculateCertificationMetrics(records: any[]): any {
  const perConnector: Record<string, any> = {};
  for (const key of connectorKeys) {
    const runs = records.filter((record) => record.connector_key === key);
    perConnector[key] = {
      real_runs: runs.length,
      passed: runs.filter((record) => record.status === 'passed').length,
      time_per_run_ms: runs.map((record) => record.duration_ms)
    };
  }
  return {
    source: 'preserved local-instance certification run records',
    total_real_runs: records.length,
    local_instance_reliability: {
      n: records.length,
      passed: records.filter((record) => record.status === 'passed').length,
      pass_rate: records.length
        ? records.filter((record) => record.status === 'passed').length / records.length
        : 0
    },
    per_connector: perConnector
  };
}

function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(process.env.API_TOKEN ? { authorization: `Bearer ${process.env.API_TOKEN}` } : {}),
    ...extra
  };
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchJson(url: string, init?: any): Promise<any> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error: any) {
      throw new Error(`HTTP request to ${new URL(url).pathname} failed: ${error.message}`);
    }
    const text = await response.text();
    let body: any;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    if (response.status === 429 && body.error?.code === 'RATE_LIMITED') {
      const seconds = Number(response.headers.get('retry-after') || 60);
      await delay(Math.max(1, seconds) * 1000);
      continue;
    }
    return { status: response.status, headers: response.headers, body };
  }
  throw new Error('API request remained rate limited after waiting for reset');
}

function scenarioDestination(destination: any, scenario: string): any {
  const copy = JSON.parse(JSON.stringify(destination));
  const base = new URL(copy.config.base_url);
  const segments = base.pathname.split('/');
  segments[segments.length - 1] = scenario;
  base.pathname = segments.join('/');
  copy.config.base_url = base.toString().replace(/\/$/, '');
  return copy;
}

async function connectorCall(api: string, key: string, method: string, payload: any, idempotencyKey?: string): Promise<any> {
  return fetchJson(`${api}/connector/v1/${key}/${method}`, {
    method: 'POST',
    headers: apiHeaders(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    body: JSON.stringify(payload)
  });
}

function stateItems(state: any): any[] {
  return state.posts || state.articles || [];
}

function activeMarkerItems(connector: string, state: any, marker: string): any[] {
  return stateItems(state).filter((item) => {
    if (item.deleted || item.published === false) return false;
    if (connector === 'ghost') return item.slug === `ix-${marker}`;
    return JSON.stringify(item).includes(marker);
  });
}

function platformId(post: any): string {
  return String(post.topic_id || post.post_id || post.id);
}

async function stateFor(api: string, destination: any): Promise<any> {
  const base = new URL(destination.config.base_url);
  const route = `${base.pathname.replace(/\/$/, '')}/_state`;
  return fetchJson(new URL(route, api).toString());
}

async function deleteMeasuredPost(api: string, connector: string, destination: any, postId: string): Promise<void> {
  const payload = { destination, platform_post_id: postId };
  const deleted = await connectorCall(api, connector, 'delete', payload);
  if (deleted.status !== 200 || deleted.body.deleted !== true) {
    throw new Error(`Could not delete a ${connector} simulation measurement post`);
  }
  const status = await connectorCall(api, connector, 'get_status', payload);
  if (status.status !== 200 || status.body.status !== 'deleted') {
    throw new Error(`Could not verify removal of a ${connector} measurement post`);
  }
}

async function measureDisposablePublishes(api: string): Promise<any> {
  const listing = await fetchJson(`${api}/api/v1/destinations?limit=200`, { headers: apiHeaders() });
  if (listing.status !== 200) throw new Error('Could not list seeded simulation destinations');
  const destinations = new Map<string, any>();
  for (const connector of publishCore) {
    const destination = listing.body.items.find((item: any) => item.name === `sim-healthy-${connector}`);
    if (!destination) throw new Error(`Missing healthy simulation destination for ${connector}`);
    destinations.set(connector, destination);
  }
  const perConnector: Record<string, any> = {};
  let successes = 0;
  let failures = 0;
  for (const connector of publishCore) perConnector[connector] = { n: 0, successes: 0, failures: 0 };
  for (let index = 0; index < 100; index += 1) {
    const connector = publishCore[index % publishCore.length];
    const destination = destinations.get(connector);
    const key = `measure-100-${Date.now()}-${index}`;
    const payload = {
      destination,
      rendition: {
        title: `Disposable ${connector} measurement ${index}`,
        body: 'Local simulation measurement; removed immediately after status verification.'
      }
    };
    const response = await connectorCall(api, connector, 'publish', payload, key);
    perConnector[connector].n += 1;
    if (response.status === 200 && response.body.platform_post_id) {
      successes += 1;
      perConnector[connector].successes += 1;
      await deleteMeasuredPost(api, connector, destination, String(response.body.platform_post_id));
    } else {
      failures += 1;
      perConnector[connector].failures += 1;
    }
  }
  return { n: 100, successes, failures, success_rate: successes / 100, per_connector: perConnector };
}

async function measureTimeoutRetries(api: string): Promise<any> {
  const listing = await fetchJson(`${api}/api/v1/destinations?limit=200`, { headers: apiHeaders() });
  const destinations = new Map<string, any>();
  for (const connector of publishCore) {
    const destination = listing.body.items.find((item: any) => item.name === `sim-healthy-${connector}`);
    destinations.set(connector, destination);
  }
  let duplicates = 0;
  let successes = 0;
  for (let index = 0; index < 20; index += 1) {
    const connector = publishCore[index % publishCore.length];
    const key = `measure-timeout-${Date.now()}-${index}`;
    const destination = scenarioDestination(destinations.get(connector), 'timeout_after_success');
    const payload = {
      destination,
      rendition: {
        title: `Timeout retry ${connector} ${index}`,
        body: `Disposable retry measurement marker ${markerFor(key)}.`
      }
    };
    const first = await connectorCall(api, connector, 'publish', payload, key);
    const retry = first.status === 503 && first.body.error?.code === 'PLATFORM_UNAVAILABLE'
      ? await connectorCall(api, connector, 'publish', payload, key)
      : first;
    if (retry.status === 200 && retry.body.platform_post_id) successes += 1;
    const state = await stateFor(api, destination);
    const posts = activeMarkerItems(connector, state.body, markerFor(key));
    duplicates += Math.max(0, posts.length - 1);
    for (const post of posts) {
      await deleteMeasuredPost(api, connector, destination, platformId(post));
    }
    const after = await stateFor(api, destination);
    if (activeMarkerItems(connector, after.body, markerFor(key)).length !== 0) {
      throw new Error(`A ${connector} timeout measurement post remains after cleanup`);
    }
  }
  return { n: 20, successes, failures: 20 - successes, duplicate_posts: duplicates };
}

async function measureSimulation(api: string): Promise<any> {
  const disposable = await measureDisposablePublishes(api);
  const retries = await measureTimeoutRetries(api);
  return {
    ...disposable,
    publish_capable_core_connectors: publishCore,
    assisted_note: 'Assisted is a Core connector without automated publish or delete operations.',
    forced_timeout_retries: retries,
    duplicate_posts_under_retry: retries.duplicate_posts
  };
}

function certificationRecords(root: string): any[] {
  return ['lemmy', 'ghost'].map((key) => {
    const record = readJson(path.join(root, `evidence/cert-${key}-real.json`));
    return { ...record, connector_key: record.connector_key || key };
  });
}

function main(): void {
  const args = process.argv.slice(2);
  const apiIndex = args.indexOf('--api');
  const api = (apiIndex >= 0 && args[apiIndex + 1] || process.env.MEASURE_API_URL || 'http://127.0.0.1:8000')
    .replace(/\/$/, '');
  void run(api).catch((error) => {
    process.stderr.write(`Measurement failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

async function run(api: string): Promise<void> {
  const root = path.resolve(__dirname, '..', '..');
  const records = certificationRecords(root);
  const catalogue = readJson(path.join(root, 'evidence/catalogue-1000-import.json'));
  if (catalogue.rows !== 1000 || catalogue.seconds > 300) {
    throw new Error('The saved catalogue import record does not verify the 1,000-row target');
  }
  const rulesMetrics = calculateRuleMetrics(readJson(path.join(root, 'tests/fixtures/rule-cases.json')));
  const simulation = await measureSimulation(api);
  if (simulation.duplicate_posts_under_retry !== 0 || rulesMetrics.violations_missed !== 0) {
    throw new Error('Duplicate-post or missed-rule measurement failed');
  }
  const metrics = {
    measured_at: new Date().toISOString(),
    certifications: calculateCertificationMetrics(records),
    simulation_publish: simulation,
    rule_violations: rulesMetrics,
    catalogue_import: catalogue,
    cost_per_1000_publications_usd: 0,
    cost_basis: 'Mock platform APIs; excludes hosting and storage infrastructure.'
  };
  fs.writeFileSync(path.join(root, 'evidence/metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`);
  writeCertificationPack(root, records);
  process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);
}

function writeCertificationPack(root: string, records: any[]): void {
  for (const record of records) {
    const destination = path.join(root, 'certification-pack', record.connector_key);
    fs.mkdirSync(destination, { recursive: true });
    const text = `${JSON.stringify(record, null, 2)}\n`;
    fs.writeFileSync(path.join(destination, 'run-record.json'), text);
    fs.writeFileSync(path.join(destination, 'api-response.json'), text);
    fs.writeFileSync(
      path.join(destination, 'deletion-confirmation.json'),
      `${JSON.stringify(record.deletion_confirmation, null, 2)}\n`
    );
  }
}

export { calculateCertificationMetrics, calculateRuleMetrics };

if (require.main === module) main();
