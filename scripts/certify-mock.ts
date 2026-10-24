/**
 * Certifies the healthy simulation destinations through the public API.
 * Saved pack records contain only whitelisted status and step fields.
 */
export {};

const fs = require('fs');
const path = require('path');

const connectorKeys = ['discourse', 'devto', 'webhook', 'assisted'];

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...(process.env.API_TOKEN ? { authorization: `Bearer ${process.env.API_TOKEN}` } : {}),
    ...extra
  };
}

async function requestJson(url: string, init?: any): Promise<any> {
  const response = await fetch(url, init);
  let body: any;
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  return { status: response.status, body };
}

function safeRun(key: string, destination: any, run: any): any {
  const steps = Array.isArray(run.steps) ? run.steps.map((step: any) => ({
    name: step.name,
    status: step.status,
    ...(step.code ? { code: step.code } : {})
  })) : [];
  return {
    connector_key: key,
    destination_name: destination.name,
    instance_type: 'MOCK instance, not a real platform',
    run_id: run.id,
    status: run.status,
    level: run.level_awarded,
    steps,
    delete_supported: key !== 'assisted',
    ...(key === 'assisted' ? { note: 'Assisted connector has no delete operation.' } : {})
  };
}

async function certifyOne(api: string, key: string, outputRoot: string): Promise<any> {
  const listed = await requestJson(`${api}/api/v1/destinations?limit=200`, {
    headers: headers()
  });
  if (listed.status !== 200) throw new Error(`Destination lookup failed for ${key}: HTTP ${listed.status}`);
  const destination = listed.body.items.find((item: any) => item.name === `sim-healthy-${key}`);
  if (!destination) throw new Error(`Seeded healthy destination is missing for ${key}`);
  const run = await requestJson(`${api}/api/v1/destinations/${destination.id}/certify?wait=true`, {
    method: 'POST',
    headers: headers({ 'idempotency-key': `certify-mock-${key}-${Date.now()}` })
  });
  if (run.status !== 200 || run.body.status !== 'passed') {
    const code = run.body.error?.code || run.body.failure_code || 'CERTIFICATION_FAILED';
    throw new Error(`Certification failed for ${key}: HTTP ${run.status}, code ${code}`);
  }
  const record = safeRun(key, destination, run.body);
  const directory = path.join(outputRoot, key);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'run.json'), `${JSON.stringify(record, null, 2)}\n`);
  fs.writeFileSync(
    path.join(directory, 'README.md'),
    `# ${key} mock certification\n\n${record.instance_type}.\n`
  );
  return { connector_key: key, status: record.status, level: record.level, steps: record.steps };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apiIndex = args.indexOf('--api');
  const api = String(
    (apiIndex >= 0 && args[apiIndex + 1]) || process.env.CERTIFY_API_URL || 'http://127.0.0.1:8000'
  ).replace(/\/$/, '');
  const root = path.resolve(__dirname, '..', '..');
  const results = [];
  for (const key of connectorKeys) {
    results.push(await certifyOne(api, key, path.join(root, 'certification-pack')));
  }
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error: any) => {
    process.stderr.write(`Mock certification failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
