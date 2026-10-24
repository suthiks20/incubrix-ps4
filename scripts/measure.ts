/**
 * Builds evidence-backed metrics from saved certification and catalogue records.
 * Runs two isolated mock publications to measure retry safety and cleanup.
 */
import fs from 'fs';
import path from 'path';
import rules = require('../src/modules/rules/engine');

const connectorKeys = [
  'discourse', 'lemmy', 'devto', 'ghost', 'webhook', 'assisted', 'mrss', 'slack', 'hashnode'
];
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
  return { source: 'preserved real certification run records', total_real_runs: records.length, per_connector: perConnector };
}

async function fetchJson(url: string, init?: any): Promise<any> {
  const response = await fetch(url, init);
  const text = await response.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { status: response.status, headers: response.headers, body };
}

function connectorPayload(baseUrl: string, scenario: string, key: string, title: string): any {
  return {
    idempotency_key: key,
    destination_ref: `${baseUrl}/mock/discourse/${scenario}`,
    connection: { api_key: 'measure-fake-key', api_username: 'measure-user' },
    rendition: { title, body: 'Local measurement post; deleted immediately after verification.' }
  };
}

async function deleteMeasuredPost(api: string, payload: any, postId: string): Promise<void> {
  const response = await fetchJson(`${api}/connector/v1/discourse/delete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      destination_ref: payload.destination_ref,
      connection: payload.connection,
      platform_post_id: postId
    })
  });
  if (response.status !== 200 || response.body.deleted !== true) {
    throw new Error('Could not delete the simulation measurement post');
  }
  const status = await fetchJson(`${api}/connector/v1/discourse/get_status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      destination_ref: payload.destination_ref,
      connection: payload.connection,
      platform_post_id: postId
    })
  });
  if (status.status !== 200 || status.body.status !== 'deleted') {
    throw new Error('Could not verify removal of the simulation measurement post');
  }
}

async function runMeasuredPublish(api: string, payload: any): Promise<any> {
  const response = await fetchJson(`${api}/connector/v1/discourse/publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': payload.idempotency_key },
    body: JSON.stringify(payload)
  });
  return response;
}

async function measureSimulation(api: string): Promise<any> {
  const runId = `measure-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const outcomes = [];
  let duplicatePosts = 0;
  for (const scenario of [`${runId}-normal`, 'timeout_after_success']) {
    const title = `Measurement ${runId} ${scenario}`;
    const payload = connectorPayload(api, scenario, `${runId}-${scenario}`, title);
    const first = await runMeasuredPublish(api, payload);
    let published = first;
    let requests = 1;
    if (scenario === 'timeout_after_success') {
      if (first.status !== 503 || first.body.error?.code !== 'PLATFORM_UNAVAILABLE') {
        throw new Error('Timeout measurement did not produce the expected retryable failure');
      }
      published = await runMeasuredPublish(api, payload);
      requests += 1;
    }
    if (published.status !== 200 || !published.body.platform_post_id) {
      throw new Error('Simulation measurement publish did not succeed');
    }
    let matching: any[] = [];
    try {
      const state = await fetchJson(`${payload.destination_ref}/_state`);
      matching = (state.body.posts || []).filter((post: any) => post.title === title);
      duplicatePosts += Math.max(0, matching.length - 1);
      if (matching.length !== 1) throw new Error('Retry measurement did not create exactly one post');
    } finally {
      const postIds = [...new Set([
        ...matching.map((post: any) => String(post.topic_id)),
        String(published.body.platform_post_id)
      ])];
      const cleanupErrors = [];
      for (const postId of postIds) {
        try {
          await deleteMeasuredPost(api, payload, postId);
        } catch (error: any) {
          cleanupErrors.push(error.message);
        }
      }
      if (cleanupErrors.length) {
        throw new Error(`Measurement cleanup failed: ${cleanupErrors.join('; ')}`);
      }
      const afterDelete = await fetchJson(`${payload.destination_ref}/_state`);
      const remaining = (afterDelete.body.posts || []).filter((post: any) => post.title === title);
      if (remaining.length) throw new Error('A simulation measurement post remains after cleanup');
    }
    outcomes.push({ scenario, succeeded: true, publish_requests: requests, posts_after_retry: matching.length });
  }
  return {
    logical_publications: outcomes.length,
    successful_publications: outcomes.filter((item) => item.succeeded).length,
    success_rate: outcomes.length ? outcomes.filter((item) => item.succeeded).length / outcomes.length : 0,
    duplicate_posts_under_retry: duplicatePosts,
    outcomes
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
