/**
 * Tests the optional authentication hook independently from destination storage.
 * Fastify injection verifies public paths and bearer-token comparisons.
 */
const Fastify = require('fastify');
const auth = require('../../src/shared/plugins/auth');
const registerErrorHandlers = require('../../src/shared/errors/errorHandler');

async function buildAuthApp(apiToken) {
  const app = Fastify({ logger: false });
  await auth(app, { apiToken });
  registerErrorHandlers(app);
  app.get('/api/v1/data', async () => ({ ok: true }));
  app.get('/api/v1/health', async () => ({ status: 'ok' }));
  app.get('/connector/v1/data', async () => ({ ok: true }));
  app.get('/public', async () => ({ ok: true }));
  await app.ready();
  return app;
}

test('disabled auth lets all paths through', async () => {
  const app = await buildAuthApp('');
  expect((await app.inject('/api/v1/data')).statusCode).toBe(200);
  expect((await app.inject('/connector/v1/data')).statusCode).toBe(200);
  await app.close();
});
test('enabled auth blocks missing and wrong tokens', async () => {
  const app = await buildAuthApp('correct-token');
  for (const headers of [{}, { authorization: 'Bearer wrong' }]) {
    const response = await app.inject({ method: 'GET', url: '/api/v1/data', headers });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  }
  await app.close();
});
test('allows the versioned health route without a token', async () => {
  const app = await buildAuthApp('correct-token');
  expect((await app.inject('/api/v1/health')).statusCode).toBe(200);
  expect((await app.inject('/public')).statusCode).toBe(200);
  await app.close();
});
