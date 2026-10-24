/**
 * Certifies the local Lemmy and Ghost destinations through the running API.
 * Only a passing, secret-free run and a verified deletion check are written.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const apiUrl = process.env.CERTIFY_API_URL || 'http://localhost:8000';
const requiredSteps = ['publish', 'confirm_live', 'read_status', 'delete', 'verify_gone'];

async function readJsonFile(filePath: string): Promise<any> {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function request(url: string, init: any = {}): Promise<any> {
  const response = await fetch(url, init);
  const text = await response.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  return { status: response.status, ok: response.ok, body };
}

function connectionFor(connections: any, connectorKey: string): any {
  return connections[`${connectorKey}_local`] || connections[connectorKey] || {};
}

async function waitForConnections(): Promise<any> {
  const filePath = process.env.CONNECTIONS_FILE || '/app/data/connections.json';
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try {
      const connections = await readJsonFile(filePath);
      if (connectionFor(connections, 'lemmy') && connectionFor(connections, 'ghost')) {
        return connections;
      }
    } catch {
      // The bootstrap service may still be writing the shared file.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('bootstrap:connections_file:NOT_READY');
}

async function findOrCreateDestination(sample: any): Promise<any> {
  const list = await request(
    `${apiUrl}/api/v1/destinations?connector_key=${sample.connector_key}&limit=200`
  );
  if (!list.ok) throw new Error(`destination_list_HTTP_${list.status}`);
  const found = list.body.items.find((item: any) =>
    item.connector_key === sample.connector_key &&
    item.connection_ref === sample.connection_ref &&
    item.url === sample.url
  );
  if (found) return found;

  const created = await request(`${apiUrl}/api/v1/destinations`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': `real-destination-${sample.connector_key}`
    },
    body: JSON.stringify(sample)
  });
  if (!created.ok) {
    const code = created.body.error?.code || `HTTP_${created.status}`;
    throw new Error(`destination_create_${code}`);
  }
  return created.body;
}

function failingStep(run: any): { step: string; code: string } {
  const failed = run.steps?.find((step: any) => step.status === 'failed');
  return {
    step: run.failure_step || failed?.name || 'certification',
    code: run.failure_code || failed?.error?.code || 'CERTIFICATION_FAILED'
  };
}

function assertPassedRun(run: any, connectorKey: string): void {
  const result = failingStep(run);
  if (run.status !== 'passed' || run.level_awarded !== 'L3') {
    throw new Error(`${connectorKey}:${result.step}:${result.code}`);
  }
  for (const name of requiredSteps) {
    const step = run.steps?.find((entry: any) => entry.name === name);
    if (!step || step.status !== 'passed') throw new Error(`${connectorKey}:${name}:STEP_NOT_PASSED`);
  }
  if (run.test_post_deleted !== true) {
    throw new Error(`${connectorKey}:verify_gone:POST_NOT_DELETED`);
  }
}

async function lemmyDeletionCheck(run: any, connection: any): Promise<any> {
  const origin = 'http://lemmy:8536';
  let jwt = connection.jwt;
  if (!jwt) {
    const login = await request(`${origin}/api/v3/user/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username_or_email: connection.username || connection.api_username,
        password: connection.password || connection.api_key
      })
    });
    jwt = login.body.jwt;
  }
  if (!jwt) throw new Error('lemmy:verify_gone:AUTH_FAILED');
  const response = await request(
    `${origin}/api/v3/post?id=${encodeURIComponent(run.platform_post_id)}`,
    { headers: { authorization: `Bearer ${jwt}` } }
  );
  const removed = response.status === 404 || response.body.post_view?.post?.deleted === true;
  if (!removed) throw new Error('lemmy:verify_gone:POST_STILL_PRESENT');
  return { method: 'GET', status_code: response.status, removed: true };
}

function ghostToken(apiKey: string): string {
  const [id, secret] = String(apiKey || '').split(':');
  if (!id || !secret || !/^[a-f0-9]+$/i.test(secret)) {
    throw new Error('ghost:verify_gone:AUTH_FAILED');
  }
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iat: issuedAt,
    exp: issuedAt + 300,
    aud: '/admin/'
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function ghostDeletionCheck(run: any, connection: any): Promise<any> {
  const key = connection.api_key || connection.admin_api_key;
  const response = await request(
    `http://ghost:2368/ghost/api/admin/posts/${encodeURIComponent(run.platform_post_id)}/`,
    {
      headers: {
        authorization: `Ghost ${ghostToken(key)}`,
        'accept-version': 'v6.0'
      }
    }
  );
  if (response.status !== 404) throw new Error('ghost:verify_gone:POST_STILL_PRESENT');
  return { method: 'GET', status_code: response.status, removed: true };
}

function secretFreeRun(run: any, deletionConfirmation: any): any {
  return {
    id: run.id,
    destination_id: run.destination_id,
    connector_key: run.connector_key,
    status: run.status,
    level_awarded: run.level_awarded,
    failure_code: run.failure_code,
    failure_step: run.failure_step,
    platform_post_id: run.platform_post_id,
    live_url: run.live_url,
    test_post_deleted: run.test_post_deleted,
    evidence_key: run.evidence_key,
    evidence_link: run.evidence_link,
    started_at: run.started_at,
    finished_at: run.finished_at,
    duration_ms: run.duration_ms,
    steps: run.steps.map((step: any) => ({
      name: step.name,
      status: step.status,
      summary: step.summary,
      started_at: step.started_at,
      duration_ms: step.duration_ms,
      error: step.error ? { code: step.error.code } : undefined
    })),
    deletion_confirmation: deletionConfirmation
  };
}

async function certifyOne(
  connectorKey: string,
  deletionCheck: Function,
  connections: any
): Promise<any> {
  const samplePath = path.resolve('samples', 'destinations', `local-${connectorKey}.json`);
  const sample = await readJsonFile(samplePath);
  const destination = await findOrCreateDestination(sample);
  const response = await request(
    `${apiUrl}/api/v1/destinations/${destination.id}/certify?wait=true`,
    {
      method: 'POST',
      headers: { 'idempotency-key': `real-cert-${connectorKey}-${crypto.randomUUID()}` }
    }
  );
  if (!response.ok) {
    const code = response.body.error?.code || `HTTP_${response.status}`;
    throw new Error(`${connectorKey}:certification:${code}`);
  }
  const run = response.body;
  assertPassedRun(run, connectorKey);
  const confirmation = await deletionCheck(run, connectionFor(connections, connectorKey));
  const evidence = secretFreeRun(run, confirmation);
  const outputPath = path.resolve('evidence', `cert-${connectorKey}-real.json`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  return {
    connector_key: connectorKey,
    status: evidence.status,
    level: evidence.level_awarded,
    steps: evidence.steps.map((step: any) => `${step.name}:${step.status}`)
  };
}

async function main(): Promise<void> {
  const connections = await waitForConnections();
  for (const [connectorKey, deletionCheck] of [
    ['lemmy', lemmyDeletionCheck],
    ['ghost', ghostDeletionCheck]
  ] as Array<[string, Function]>) {
    const summary = await certifyOne(connectorKey, deletionCheck, connections);
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  }
}

main().catch((error: any) => {
  process.stderr.write(`real certification failed: ${error.message}\n`);
  process.exitCode = 1;
});
