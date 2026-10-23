/**
 * Verifies connector publishes accept the standard Idempotency-Key HTTP header.
 * The connector ledger still owns replay and conflict behaviour after normalization.
 */
const buildApp = require('../../src/app');
const { createTestDatabase } = require('./testDatabase');

let app;
let knex;
let destinationRef;

beforeAll(async () => {
  knex = createTestDatabase();
  app = buildApp({ knex, apiToken: '' });
  await app.listen({ port: 0, host: '127.0.0.1' });
  destinationRef = `http://127.0.0.1:${app.server.address().port}/mock/discourse/normal`;
});

beforeEach(async () => {
  await knex('publish_ledger').del();
  await fetch(`${destinationRef}/_reset`, { method: 'POST' });
});

afterAll(async () => {
  await app.close();
  await knex.destroy();
});

function body(idempotencyKey) {
  return {
    ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    destination_ref: destinationRef,
    connection: { api_key: 'header-test-key', api_username: 'header-test-user' },
    rendition: { title: 'Header idempotency title', body: 'Header idempotency body' }
  };
}

function expectError(response, code) {
  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({
    error: expect.objectContaining({
      code,
      message: expect.any(String),
      retryable: expect.any(Boolean),
      details: expect.any(Object)
    })
  });
}

test('connector publish accepts the Idempotency-Key header', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/connector/v1/discourse/publish',
    headers: { 'idempotency-key': 'connector-header-key-1' },
    payload: body()
  });
  expect(response.statusCode).toBe(200);
  expect(await knex('publish_ledger').where({ idempotency_key: 'connector-header-key-1' })).toHaveLength(1);
});

test('connector publish rejects a header that differs from the body key', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/connector/v1/discourse/publish',
    headers: { 'idempotency-key': 'connector-header-key-2' },
    payload: body('connector-body-key-2')
  });
  expectError(response, 'VALIDATION_ERROR');
});
