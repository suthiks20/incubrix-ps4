/**
 * Applies the shared public connector contract to every automated implementation.
 * It guards manifest fields and unsupported-method envelopes as the catalogue grows.
 */
const { describe } = require('@jest/globals');
const buildApp = require('../../src/app');
const codes = require('../../src/shared/errors/codes');
const registry = require('../../src/modules/connectors/registry');
const { createTestDatabase } = require('./testDatabase');

const connectorKeys = [
  'discourse', 'devto', 'lemmy', 'ghost', 'webhook', 'assisted',
  'mrss', 'slack', 'hashnode'
];
let app;
let knex;

beforeAll(async () => {
  knex = createTestDatabase();
  app = buildApp({ knex, apiToken: '' });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await knex.destroy();
});

describe.each(connectorKeys)('connector contract: %s', (key) => {
  test('has a valid manifest and standard contract envelopes', async () => {
    const entry = registry.get(key);
    expect(entry.manifest).toEqual(expect.objectContaining({
      key,
      version: expect.any(String),
      tier: expect.any(String),
      auth: expect.any(String),
      capabilities: expect.any(Array),
      error_map: expect.any(Object)
    }));
    for (const code of Object.values(entry.manifest.error_map)) expect(codes[code]).toBeDefined();
    const valid = await app.inject({
      method: 'POST',
      url: `/connector/v1/${key}/validate`,
      payload: { rendition: { title: 'Valid title', body: 'Valid body' } }
    });
    expect(valid.json()).toEqual({ ok: expect.any(Boolean), violations: expect.any(Array) });
    const unknown = await app.inject({ method: 'POST', url: `/connector/v1/${key}/missing`, payload: {} });
    expect(unknown.statusCode).toBe(501);
    expect(unknown.json()).toEqual({
      error: expect.objectContaining({
        code: 'CONNECTOR_NOT_IMPLEMENTED',
        message: expect.any(String),
        retryable: expect.any(Boolean),
        details: expect.any(Object)
      })
    });
  });
});
