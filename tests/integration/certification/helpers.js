/**
 * Test harness for certification: an app with an injected clock, a temp evidence folder and a real port.
 * The port lets the in-process mock platforms be reached over HTTP, exactly like a real platform.
 */
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const buildApp = require('../../../src/app');
const baseConfig = require('../../../src/config');
const { createTestDatabase } = require('../testDatabase');
const { createLocal } = require('../../../src/shared/storage/local');

const MOCK_SCENARIOS = {
  discourse: ['normal', 'renamed_field', 'unavailable', 'expired_token', 'delete_fails_once', 'delete_fails_twice'],
  webhook: ['normal', 'renamed_field']
};

async function createContext(options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ix-cert-'));
  const knex = createTestDatabase();
  const config = { ...baseConfig, CERT_ALLOWED_HOSTS: ['127.0.0.1'], STORAGE_DIR: directory };
  const app = buildApp({
    knex,
    apiToken: options.apiToken || '',
    config,
    storage: createLocal(directory),
    now: options.now || (() => new Date()),
    connectorFactory: options.connectorFactory
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const port = app.server.address().port;
  const close = async () => {
    await app.close();
    await knex.destroy();
    await fs.rm(directory, { recursive: true, force: true });
  };
  return { app, knex, directory, port, mockRoot: `http://127.0.0.1:${port}/mock`, close };
}

async function reset(ctx) {
  await ctx.knex.raw('TRUNCATE destinations, certification_runs, destination_alerts CASCADE');
  await ctx.knex.raw('TRUNCATE publish_ledger, idempotency_keys');
  for (const [connector, scenarios] of Object.entries(MOCK_SCENARIOS)) {
    for (const scenario of scenarios) {
      await fetch(`${ctx.mockRoot}/${connector}/${scenario}/_reset`, { method: 'POST' });
    }
  }
}

// Creates a destination row whose base_url points at one mock scenario of this test app.
function createDestination(ctx, connector, scenario, overrides = {}) {
  const baseUrl = `${ctx.mockRoot}/${connector}/${scenario}`;
  const row = {
    name: `Cert ${connector} ${scenario}`,
    url: baseUrl,
    url_normalized: baseUrl,
    platform_key: connector,
    connector_key: connector,
    config: JSON.stringify({ base_url: baseUrl }),
    language: 'en',
    ...overrides
  };
  return ctx.knex('destinations').insert(row).returning('*').then((rows) => rows[0]);
}

function certify(ctx, destinationId, idempotencyKey) {
  return ctx.app.inject({
    method: 'POST',
    url: `/api/v1/destinations/${destinationId}/certify`,
    headers: { 'idempotency-key': idempotencyKey }
  });
}

async function mockState(ctx, connector, scenario) {
  const response = await fetch(`${ctx.mockRoot}/${connector}/${scenario}/_state`);
  return response.json();
}

module.exports = { createContext, reset, createDestination, certify, mockState };
