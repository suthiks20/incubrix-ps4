/**
 * Verifies an S3 readiness probe aborts a non-responsive endpoint promptly.
 * The fake endpoint accepts the request but intentionally never replies.
 */
const http = require('http');
const buildApp = require('../../src/app');
const baseConfig = require('../../src/config');
const { createTestDatabase } = require('./testDatabase');

let app;
let knex;
let server;

beforeAll(async () => {
  server = http.createServer(() => {});
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  knex = createTestDatabase();
  app = buildApp({
    knex,
    apiToken: '',
    config: {
      ...baseConfig,
      STORAGE_DRIVER: 's3',
      S3_ENDPOINT: `http://127.0.0.1:${port}`,
      S3_REGION: 'us-east-1',
      S3_BUCKET: 'incubrix',
      S3_ACCESS_KEY: 'fake-access-key',
      S3_SECRET_KEY: 'fake-secret-key'
    }
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await knex.destroy();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test('returns storage down within three seconds when the S3 probe times out', async () => {
  const startedAt = Date.now();
  const response = await app.inject('/ready');
  const elapsed = Date.now() - startedAt;

  expect(response.statusCode).toBe(503);
  expect(response.json()).toEqual({
    error: {
      code: 'NOT_READY',
      message: 'Service is not ready',
      retryable: true,
      details: { checks: { db: 'ok', storage: 'down' } }
    }
  });
  expect(elapsed).toBeLessThan(3000);
});
