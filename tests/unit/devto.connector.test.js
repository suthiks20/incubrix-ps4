/**
 * Unit-tests Dev.to request shaping and marker reconciliation without HTTP routes.
 * Response doubles keep the connector contract deterministic and small.
 */
const { createDevto } = require('../../src/modules/connectors/devto');
const { markerFor } = require('../../src/modules/connectors/commons/marker');

function response(body) {
  return { ok: true, json: async () => body };
}

function destination() {
  return { config: { base_url: 'http://devto.test' } };
}

test('devto publish body carries the ix_ref marker and the canonical url', async () => {
  let request;
  const connector = createDevto({ fetch: async (_url, init) => {
    request = init;
    return response({ id: 7, url: 'http://devto.test/articles/7' });
  } });
  await connector.publish(
    { title: 'Title', body: 'Body', canonical_url: 'https://example.test/original', tags: ['one', 'two'] },
    destination(),
    { api_key: 'fake-key' },
    'devto-unit-key'
  );
  const article = JSON.parse(request.body).article;
  expect(article.canonical_url).toBe('https://example.test/original');
  expect(article.body_markdown).toContain(`ix_ref:${markerFor('devto-unit-key')}`);
});

test('devto findByMarker ignores unpublished articles', async () => {
  const marker = markerFor('devto-find-key');
  const connector = createDevto({ fetch: async () => response([
    { id: 1, url: 'http://devto.test/1', published: false, body_markdown: `ix_ref:${marker}` },
    { id: 2, url: 'http://devto.test/2', published: true, body_markdown: 'another article' }
  ]) });
  await expect(connector.findByMarker(destination(), { api_key: 'fake-key' }, marker)).resolves.toBeNull();
});
