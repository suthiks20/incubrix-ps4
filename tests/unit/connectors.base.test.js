/**
 * Checks connector validation and platform error translation without network access.
 * Fake fetch responses keep these tests deterministic and fast.
 */
const { createBase } = require('../../src/modules/connectors/base');
const manifest = require('../../src/modules/connectors/discourse').manifest;
const config = { CONNECTOR_HTTP_TIMEOUT_MS: 100, CONNECTOR_MAX_BACKOFF_MS: 5000, CIRCUIT_FAILURE_THRESHOLD: 2, CIRCUIT_COOLDOWN_SECONDS: 60 };
function response(status, body = {}, headers = {}) { return { ok: status < 400, status, headers: new Headers(headers), json: async () => body, clone() { return this; } }; }
test('validates required fields and manifest character limits', () => {
  const base = createBase(manifest, { config });
  expect(base.validate({})).toHaveLength(2);
  expect(base.validate({ title: 'A'.repeat(256), body: 'ok' })[0].field).toBe('title');
  expect(base.validate({ title: 'valid title long', body: 'ok' })).toEqual([]);
});
test.each([[400, 'PLATFORM_CONTENT_REJECTED'], [401, 'CONNECTION_AUTH_EXPIRED'], [403, 'CONNECTION_AUTH_EXPIRED'], [422, 'PLATFORM_CONTENT_REJECTED'], [429, 'PLATFORM_RATE_LIMIT'], [500, 'PLATFORM_UNAVAILABLE']])('maps platform HTTP %s', async (status, code) => {
  const base = createBase(manifest, { config, fetch: async () => response(status, { errors: ['platform detail'] }) });
  await expect(base.request({ config: { base_url: 'http://example.test' } }, {}, 'http://example.test')).rejects.toMatchObject({ code });
});
test('retries a short rate limit once and rejects long retry windows', async () => {
  let calls = 0;
  const sleeps = [];
  const base = createBase(manifest, { config, fetch: async () => (++calls === 1 ? response(429, {}, { 'retry-after': '1' }) : response(200)), sleep: async (ms) => sleeps.push(ms) });
  await base.request({ config: { base_url: 'http://example.test' } }, {}, 'http://example.test');
  expect(calls).toBe(2);
  expect(sleeps).toEqual([1000]);
  const long = createBase(manifest, { config, fetch: async () => response(429, {}, { 'retry-after': '120' }) });
  await expect(long.request({ config: { base_url: 'http://example.test' } }, {}, 'http://example.test')).rejects.toMatchObject({ code: 'PLATFORM_RATE_LIMIT', details: { retry_after_seconds: 120 } });
});
test('flags missing response fields as schema drift', () => {
  const base = createBase(manifest, { config });
  expect(() => base.requireFields({}, ['topic_id'])).toThrow(expect.objectContaining({ code: 'SCHEMA_DRIFT' }));
});
test('opens a circuit at its failure threshold and allows requests after cooldown', async () => {
  let clock = 1000;
  let calls = 0;
  const base = createBase(manifest, {
    config: { ...config, CIRCUIT_FAILURE_THRESHOLD: 2, CIRCUIT_COOLDOWN_SECONDS: 2 },
    now: () => clock,
    fetch: async () => (++calls < 3 ? response(503) : response(200))
  });
  const destination = { config: { base_url: 'http://example.test' } };
  await expect(base.request(destination, {}, 'http://example.test')).rejects.toMatchObject({ code: 'PLATFORM_UNAVAILABLE' });
  await expect(base.request(destination, {}, 'http://example.test')).rejects.toMatchObject({ code: 'PLATFORM_UNAVAILABLE' });
  await expect(base.request(destination, {}, 'http://example.test')).rejects.toMatchObject({ code: 'PLATFORM_UNAVAILABLE' });
  expect(calls).toBe(2);
  clock += 2001;
  await expect(base.request(destination, {}, 'http://example.test')).resolves.toBeDefined();
  expect(calls).toBe(3);
});
test('maps network failures to retryable platform unavailable', async () => {
  const base = createBase(manifest, { config, fetch: async () => { throw new Error('private network details'); } });
  await expect(base.request({ config: { base_url: 'http://example.test' } }, {}, 'http://example.test')).rejects.toMatchObject({ code: 'PLATFORM_UNAVAILABLE', retryable: true, message: 'Request to the platform timed out or the connection dropped' });
});
