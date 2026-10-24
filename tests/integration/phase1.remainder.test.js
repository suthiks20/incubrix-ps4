/**
 * Verifies Phase 1 connector mock parity, media validation, and metrics normalization.
 * All platform requests use in-process simulation mocks and fake credentials.
 */
const buildApp = require('../../src/app');
const { createTestDatabase } = require('./testDatabase');
const registry = require('../../src/modules/connectors/registry');

const connectorKeys = ['discourse', 'devto', 'lemmy', 'ghost', 'webhook'];
const credentials = {
  discourse: { api_key: 'fake-key', api_username: 'fake-user' },
  devto: { api_key: 'fake-key' },
  lemmy: { username: 'fake-user', password: 'lemmy-password' },
  ghost: { api_key: 'fake-ghost-id:00112233445566778899aabbccddeeff' },
  webhook: { signing_secret: 'test-signing-secret' }
};
let app;
let knex;
let baseUrl;

beforeAll(async () => {
  knex = createTestDatabase();
  app = buildApp({ knex, apiToken: '' });
  await app.listen({ port: 0, host: '127.0.0.1' });
  baseUrl = `http://127.0.0.1:${app.server.address().port}`;
});

beforeEach(async () => {
  await knex('publish_ledger').del();
  await Promise.all(connectorKeys.map((key) =>
    fetch(`${baseUrl}/mock/${key}/normal/_reset`, { method: 'POST' })
  ));
});

afterAll(async () => {
  await app.close();
  await knex.destroy();
});

function payload(key, connector, scenario, rendition = {}) {
  return {
    idempotency_key: key,
    destination_ref: `${baseUrl}/mock/${connector}/${scenario}`,
    connection: credentials[connector],
    rendition: { title: 'A valid connector title', body: 'A valid connector body', ...rendition }
  };
}

async function publish(connector, scenario, key, rendition) {
  return app.inject({
    method: 'POST',
    url: `/connector/v1/${connector}/publish`,
    payload: payload(key, connector, scenario, rendition)
  });
}

test('HARD CASE lemmy unavailable returns PLATFORM_UNAVAILABLE', async () => {
  const response = await publish('lemmy', 'unavailable', 'phase1-lemmy-unavailable');
  expect(response.statusCode).toBe(503);
  expect(response.json().error.code).toBe('PLATFORM_UNAVAILABLE');
});

test('HARD CASE ghost expired token returns CONNECTION_AUTH_EXPIRED', async () => {
  const response = await publish('ghost', 'expired_token', 'phase1-ghost-expired');
  expect(response.statusCode).toBe(401);
  expect(response.json().error.code).toBe('CONNECTION_AUTH_EXPIRED');
});

test('HARD CASE webhook content rejected returns PLATFORM_CONTENT_REJECTED', async () => {
  const response = await publish('webhook', 'content_rejected', 'phase1-webhook-rejected');
  expect(response.statusCode).toBe(422);
  expect(response.json().error.code).toBe('PLATFORM_CONTENT_REJECTED');
});

test('HARD CASE media type not accepted returns DEST_SPEC_VIOLATION with field-level reason', async () => {
  for (const connector of connectorKeys) {
    const response = await publish(connector, 'normal', `phase1-media-${connector}`, {
      media: [{ name: 'file', url: 'https://example.test/file.pdf', type: 'application/pdf' }]
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('DEST_SPEC_VIOLATION');
    expect(response.json().error.details.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: 'media[0].type',
        reason: expect.stringContaining('application/pdf'),
        allowed: expect.any(Array)
      })
    ]));
  }
  const assisted = await app.inject({
    method: 'POST',
    url: '/connector/v1/assisted/validate',
    payload: { rendition: { title: 'Valid title', body: 'Body', media: [{ url: 'file', type: 'application/pdf' }] } }
  });
  expect(assisted.json()).toEqual({ ok: true, violations: [] });
});

test('destination media_types override the manifest media types', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/connector/v1/discourse/validate',
    payload: {
      destination: {
        config: {
          base_url: `${baseUrl}/mock/discourse/normal`,
          media_types: ['application/pdf']
        }
      },
      rendition: {
        title: 'Valid title',
        body: 'Body',
        media: [{ url: 'https://example.test/file.pdf', type: 'application/pdf' }]
      }
    }
  });
  expect(response.json()).toEqual({ ok: true, violations: [] });
});

test('fetch_metrics returns normalised counters for discourse', async () => {
  const published = await publish('discourse', 'normal', 'phase1-metrics-discourse');
  const response = await app.inject({
    method: 'POST',
    url: '/connector/v1/discourse/fetch_metrics',
    payload: {
      destination_ref: `${baseUrl}/mock/discourse/normal`,
      connection: credentials.discourse,
      platform_post_id: published.json().platform_post_id
    }
  });
  expect(response.json()).toEqual({
    views: 321, likes: 17, comments: 6, shares: 3, saves: 2, watch_time_s: 45, clicks: 9
  });
});

test('fetch_metrics returns normalised counters for devto', async () => {
  const published = await publish('devto', 'normal', 'phase1-metrics-devto');
  const response = await app.inject({
    method: 'POST',
    url: '/connector/v1/devto/fetch_metrics',
    payload: {
      destination_ref: `${baseUrl}/mock/devto/normal`,
      connection: credentials.devto,
      platform_post_id: published.json().platform_post_id
    }
  });
  expect(response.json()).toEqual({
    views: 321, likes: 17, comments: 6, shares: 0, saves: 0, watch_time_s: 0, clicks: 0
  });
});

test('fetch_metrics returns normalised counters for ghost', async () => {
  const published = await publish('ghost', 'normal', 'phase1-metrics-ghost');
  const response = await app.inject({
    method: 'POST',
    url: '/connector/v1/ghost/fetch_metrics',
    payload: {
      destination_ref: `${baseUrl}/mock/ghost/normal`,
      connection: credentials.ghost,
      platform_post_id: published.json().platform_post_id
    }
  });
  expect(response.json()).toEqual({
    views: 321, likes: 17, comments: 6, shares: 3, saves: 2, watch_time_s: 45, clicks: 9
  });
});

test('manifest capabilities match implemented methods for every connector', () => {
  const methods = {
    publish: 'publish',
    status: 'get_status',
    delete: 'delete',
    metrics: 'fetch_metrics',
    refresh_auth: 'refresh_auth',
    assist: 'build_assist_pack'
  };
  for (const entry of registry.values()) {
    const connector = entry.createConnector();
    for (const [capability, method] of Object.entries(methods)) {
      expect(entry.manifest.capabilities.includes(capability)).toBe(typeof connector[method] === 'function');
    }
  }
});

test('unimplemented connector metrics retain the shared unsupported error', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/connector/v1/lemmy/fetch_metrics',
    payload: {
      destination_ref: `${baseUrl}/mock/lemmy/normal`,
      connection: credentials.lemmy,
      platform_post_id: '1'
    }
  });
  expect(response.statusCode).toBe(501);
  expect(response.json().error.code).toBe('CONNECTOR_NOT_IMPLEMENTED');
});
