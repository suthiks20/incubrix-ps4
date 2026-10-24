/**
 * Verifies Phase 1 connector mock parity, media validation, and metrics normalization.
 * All platform requests use in-process simulation mocks and fake credentials.
 */
const buildApp = require('../../src/app');
const { createTestDatabase } = require('./testDatabase');
const registry = require('../../src/modules/connectors/registry');
const pino = require('pino');
const { PassThrough } = require('stream');
const loggerOptions = require('../../src/shared/logger');

const connectorKeys = [
  'discourse', 'devto', 'lemmy', 'ghost', 'webhook', 'mrss', 'slack', 'hashnode'
];
const credentials = {
  discourse: { api_key: 'fake-key', api_username: 'fake-user' },
  devto: { api_key: 'fake-key' },
  lemmy: { username: 'fake-user', password: 'lemmy-password' },
  ghost: { api_key: 'fake-ghost-id:00112233445566778899aabbccddeeff' },
  webhook: { signing_secret: 'test-signing-secret' },
  mrss: { api_key: 'mrss-test-token' },
  slack: { bot_token: 'slack-test-token' },
  hashnode: { api_key: 'hashnode-test-token' }
};
let app;
let knex;
let baseUrl;
let logs = '';
let logStream;

beforeAll(async () => {
  knex = createTestDatabase();
  logStream = new PassThrough();
  logStream.on('data', (chunk) => { logs += chunk; });
  app = buildApp({
    knex,
    apiToken: '',
    logger: pino({ ...loggerOptions, level: 'info' }, logStream)
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  baseUrl = `http://127.0.0.1:${app.server.address().port}`;
});

beforeEach(async () => {
  logs = '';
  await knex('publish_ledger').del();
  const scenarios = [
    'normal', 'timeout_after_success', 'renamed_field', 'rate_limit_long',
    'expired_token', 'content_rejected', 'unavailable', 'delete_fails_once',
    'delete_fails_twice'
  ];
  await Promise.all(connectorKeys.flatMap((key) =>
    scenarios.map((scenario) =>
      fetch(`${baseUrl}/mock/${key}/${scenario}/_reset`, { method: 'POST' })
    )
  ));
});

afterAll(async () => {
  await app.close();
  await knex.destroy();
  logStream.end();
});

function payload(key, connector, scenario, rendition = {}) {
  const base = `${baseUrl}/mock/${connector}/${scenario}`;
  const connectorConfig = connector === 'slack'
    ? { base_url: base, channel_id: 'C_TEST' }
    : connector === 'hashnode'
      ? { base_url: base, publication_id: 'publication-test-id' }
      : { base_url: base };
  return {
    idempotency_key: key,
    destination_ref: base,
    destination: { config: connectorConfig },
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

const mrssRendition = {
  title: 'Video update',
  body: 'A short description',
  canonical_url: 'https://videos.example.test/watch?a=1&b=2',
  media: [{ name: 'clip', url: 'https://cdn.example.test/clip?x=1&y=2', type: 'video/mp4' }]
};

function mrssDestination(scenario, name = 'MRSS destination') {
  const base = `${baseUrl}/mock/mrss/${scenario}`;
  return knex('destinations').insert({
    name,
    url: `https://feeds.example.test/${scenario}`,
    url_normalized: `https://feeds.example.test/${scenario}`,
    platform_key: 'mrss',
    connector_key: 'mrss',
    language: 'en',
    config: JSON.stringify({ base_url: base })
  }).returning('*').then((rows) => rows[0]);
}

function createMockConnectorDestination(connector, scenario) {
  const base = `${baseUrl}/mock/${connector}/${scenario}`;
  const config = connector === 'slack'
    ? { base_url: base, channel_id: 'C_TEST' }
    : { base_url: base, publication_id: 'publication-test-id' };
  const url = `https://${connector}.example.test/${scenario}`;
  return knex('destinations').insert({
    name: `${connector} ${scenario}`,
    url,
    url_normalized: url,
    platform_key: connector,
    connector_key: connector,
    language: 'en',
    config: JSON.stringify(config)
  }).returning('*').then((rows) => rows[0]);
}

async function mrssState(base, destinationId) {
  const query = new URLSearchParams({ destination_id: destinationId });
  return fetch(`${base}/_state?${query}`).then((response) => response.json());
}

test('HARD CASE mrss timeout retry creates exactly one post', async () => {
  const request = payload('mrss-timeout-key', 'mrss', 'timeout_after_success', mrssRendition);
  const first = await app.inject({
    method: 'POST',
    url: '/connector/v1/mrss/publish',
    payload: request
  });
  expect(first.statusCode).toBe(503);
  expect(first.json().error.code).toBe('PLATFORM_UNAVAILABLE');
  const firstState = await mrssState(request.destination_ref, request.destination_ref);
  expect(firstState.posts).toHaveLength(1);
  expect(firstState.post_attempts).toBe(1);
  const retry = await app.inject({
    method: 'POST',
    url: '/connector/v1/mrss/publish',
    payload: request
  });
  expect(retry.statusCode).toBe(200);
  expect(retry.headers['idempotent-replay']).toBe('true');
  const finalState = await mrssState(request.destination_ref, request.destination_ref);
  expect(finalState.posts).toHaveLength(1);
  expect(finalState.post_attempts).toBe(1);
});

test('HARD CASE mrss renamed field returns SCHEMA_DRIFT', async () => {
  const response = await publish('mrss', 'renamed_field', 'mrss-renamed', mrssRendition);
  expect(response.statusCode).toBe(502);
  expect(response.json().error.code).toBe('SCHEMA_DRIFT');
});

test('mrss secrets never appear in logs', async () => {
  const secret = 'mrss-secret-must-never-appear';
  const response = await app.inject({
    method: 'POST',
    url: '/connector/v1/mrss/publish',
    payload: {
      ...payload('mrss-secret-key', 'mrss', 'normal', mrssRendition),
      connection: { api_key: secret }
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const ledger = await knex('publish_ledger');
  expect(response.statusCode).toBe(200);
  expect(`${logs}${response.body}${JSON.stringify(ledger)}`).not.toContain(secret);
});

test('mrss feed escapes xml and lists published items', async () => {
  const title = 'Video & <News> "today" \'live\'';
  const description = 'Description & <more> "text" \'quoted\'';
  const destination = await mrssDestination('normal', 'Feed & <Channel> "one" \'two\'');
  const response = await app.inject({
    method: 'POST',
    url: '/connector/v1/mrss/publish',
    payload: {
      destination_id: destination.id,
      idempotency_key: 'mrss-feed-xml',
      connection: credentials.mrss,
      rendition: { ...mrssRendition, title, body: description }
    }
  });
  expect(response.statusCode).toBe(200);
  const feed = await app.inject(`/feeds/${destination.id}.xml`);
  expect(feed.statusCode).toBe(200);
  expect(feed.headers['content-type']).toContain('application/rss+xml');
  expect(feed.body).toContain('<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">');
  expect(feed.body).toContain('Video &amp; &lt;News&gt; &quot;today&quot; &apos;live&apos;');
  expect(feed.body).toContain('Description &amp; &lt;more&gt; &quot;text&quot; &apos;quoted&apos;');
  expect(feed.body).toContain('url="https://cdn.example.test/clip?x=1&amp;y=2"');
  expect(feed.body).toContain('https://videos.example.test/watch?a=1&amp;b=2');
  expect(feed.body).toMatch(/<guid isPermaLink="false">[a-f0-9]{16}<\/guid>/);
});

test('mrss mock maps rate limits and platform failures', async () => {
  const cases = [
    ['rate_limit_long', 429, 'PLATFORM_RATE_LIMIT'],
    ['expired_token', 401, 'CONNECTION_AUTH_EXPIRED'],
    ['content_rejected', 422, 'PLATFORM_CONTENT_REJECTED'],
    ['unavailable', 503, 'PLATFORM_UNAVAILABLE']
  ];
  for (const [scenario, status, code] of cases) {
    const response = await publish('mrss', scenario, `mrss-${scenario}`, mrssRendition);
    expect(response.statusCode).toBe(status);
    expect(response.json().error.code).toBe(code);
  }
});

test('mrss mock supports one-time and repeated delete failures', async () => {
  for (const [scenario, failures] of [['delete_fails_once', 1], ['delete_fails_twice', 2]]) {
    const published = await publish('mrss', scenario, `mrss-${scenario}`, mrssRendition);
    expect(published.statusCode).toBe(200);
    for (let attempt = 0; attempt < failures; attempt += 1) {
      const failed = await app.inject({
        method: 'POST',
        url: '/connector/v1/mrss/delete',
        payload: {
          destination_ref: `${baseUrl}/mock/mrss/${scenario}`,
          connection: credentials.mrss,
          platform_post_id: published.json().platform_post_id
        }
      });
      expect(failed.statusCode).toBe(503);
    }
    const removed = await app.inject({
      method: 'POST',
      url: '/connector/v1/mrss/delete',
      payload: {
        destination_ref: `${baseUrl}/mock/mrss/${scenario}`,
        connection: credentials.mrss,
        platform_post_id: published.json().platform_post_id
      }
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().deleted).toBe(true);
  }
});

test('all nine connector manifests match their contract methods', () => {
  expect([...registry.keys()].sort()).toEqual([
    'assisted', 'devto', 'discourse', 'ghost', 'hashnode', 'lemmy', 'mrss', 'slack', 'webhook'
  ]);
  for (const key of ['slack', 'hashnode']) {
    const entry = registry.get(key);
    expect(entry.manifest.surfaces[0].spec.media_types).toEqual([
      'video/mp4', 'video/webm', 'image/jpeg', 'image/png'
    ]);
  }
});

test('mrss validator accepts each declared video media type', async () => {
  for (const type of ['video/mp4', 'video/webm', 'image/jpeg', 'image/png']) {
    const response = await app.inject({
      method: 'POST',
      url: '/connector/v1/mrss/validate',
      payload: { rendition: { ...mrssRendition, media: [{ url: 'https://cdn.example.test/file', type }] } }
    });
    expect(response.json()).toEqual({ ok: true, violations: [] });
  }
});

for (const connector of ['slack', 'hashnode']) {
  test(`HARD CASE ${connector} timeout retry creates exactly one post`, async () => {
    const request = payload(`${connector}-timeout-key`, connector, 'timeout_after_success');
    const first = await app.inject({
      method: 'POST',
      url: `/connector/v1/${connector}/publish`,
      payload: request
    });
    if (first.statusCode !== 503) {
      throw new Error(JSON.stringify({ body: first.json(), logs: logs.slice(-2000) }));
    }
    expect(first.json().error.code).toBe('PLATFORM_UNAVAILABLE');
    const retry = await app.inject({
      method: 'POST',
      url: `/connector/v1/${connector}/publish`,
      payload: request
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.headers['idempotent-replay']).toBe('true');
    const state = await fetch(`${baseUrl}/mock/${connector}/timeout_after_success/_state`)
      .then((response) => response.json());
    expect(state.post_attempts).toBe(1);
    expect(connector === 'slack' ? state.messages : state.posts).toHaveLength(1);
  });

  test(`HARD CASE ${connector} renamed field returns SCHEMA_DRIFT`, async () => {
    const response = await publish(connector, 'renamed_field', `${connector}-renamed`);
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('SCHEMA_DRIFT');
  });

  test(`${connector} secrets never appear in logs`, async () => {
    const secret = `${connector}-unique-fake-token-never-log`;
    const connection = connector === 'slack' ? { bot_token: secret } : { api_key: secret };
    const response = await app.inject({
      method: 'POST',
      url: `/connector/v1/${connector}/publish`,
      payload: {
        ...payload(`${connector}-secret-key`, connector, 'normal'),
        connection
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const ledger = await knex('publish_ledger');
    expect(response.statusCode).toBe(200);
    expect(`${logs}${response.body}${JSON.stringify(ledger)}`).not.toContain(secret);
  });

  test(`${connector} mock maps auth, rate limits, content rejection, and availability`, async () => {
    const cases = [
      ['expired_token', 401, 'CONNECTION_AUTH_EXPIRED'],
      ['rate_limit_long', 429, 'PLATFORM_RATE_LIMIT'],
      ['content_rejected', 422, 'PLATFORM_CONTENT_REJECTED'],
      ['unavailable', 503, 'PLATFORM_UNAVAILABLE']
    ];
    for (const [scenario, status, code] of cases) {
      const response = await publish(connector, scenario, `${connector}-${scenario}`);
      expect(response.statusCode).toBe(status);
      expect(response.json().error.code).toBe(code);
    }
  });

  test(`${connector} mock retries delete failures and confirms removed status`, async () => {
    for (const [scenario, failureCount] of [['delete_fails_once', 1], ['delete_fails_twice', 2]]) {
      const destination = await createMockConnectorDestination(connector, scenario);
      const created = await app.inject({
        method: 'POST',
        url: `/connector/v1/${connector}/publish`,
        payload: {
          destination_id: destination.id,
          idempotency_key: `${connector}-${scenario}`,
          connection: credentials[connector],
          rendition: { title: 'Delete retry title', body: 'Delete retry body' }
        }
      });
      expect(created.statusCode).toBe(200);
      for (let attempt = 0; attempt <= failureCount; attempt += 1) {
        const removed = await app.inject({
          method: 'POST',
          url: `/connector/v1/${connector}/delete`,
          payload: {
            destination_id: destination.id,
            connection: credentials[connector],
            platform_post_id: created.json().platform_post_id
          }
        });
        expect(removed.statusCode).toBe(attempt < failureCount ? 503 : 200);
      }
      const status = await app.inject({
        method: 'POST',
        url: `/connector/v1/${connector}/get_status`,
        payload: {
          destination_id: destination.id,
          connection: credentials[connector],
          platform_post_id: created.json().platform_post_id
        }
      });
      expect(status.json().status).toBe('deleted');
    }
  });
}

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
