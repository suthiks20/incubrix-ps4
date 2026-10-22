/**
 * Covers certification HTTP schemas, authentication and not-found service envelopes.
 * The real Postgres harness verifies validation occurs before certification work begins.
 */
const { createContext, reset, createDestination, certify } = require('./helpers');

let ctx;

beforeAll(async () => { ctx = await createContext(); });
beforeEach(async () => { await reset(ctx); });
afterAll(async () => { await ctx.close(); });

function expectError(response, code, statusCode) {
  expect(response.statusCode).toBe(statusCode);
  expect(response.json()).toEqual({
    error: expect.objectContaining({
      code,
      message: expect.any(String),
      retryable: expect.any(Boolean),
      details: expect.any(Object)
    })
  });
}

test('certify with an invalid uuid returns 400 VALIDATION_ERROR', async () => {
  expectError(await certify(ctx, 'not-a-uuid', 'bad-id'), 'VALIDATION_ERROR', 400);
});

test('certify an unknown destination returns 404 NOT_FOUND', async () => {
  expectError(await certify(ctx, '00000000-0000-0000-0000-000000000000', 'unknown'), 'NOT_FOUND', 404);
});

test('unknown run returns 404 NOT_FOUND', async () => {
  const response = await ctx.app.inject({
    method: 'GET',
    url: '/api/v1/certification/runs/00000000-0000-0000-0000-000000000000'
  });
  expectError(response, 'NOT_FOUND', 404);
});

test('unknown evidence returns 404 NOT_FOUND', async () => {
  const response = await ctx.app.inject({
    method: 'GET',
    url: '/api/v1/certification/runs/00000000-0000-0000-0000-000000000000/evidence'
  });
  expectError(response, 'NOT_FOUND', 404);
});

test('runs list rejects unknown filters, bad status and bad limit with 400', async () => {
  for (const query of ['?bogus=1', '?status=nope', '?limit=0']) {
    const response = await ctx.app.inject({ method: 'GET', url: `/api/v1/certification/runs${query}` });
    expectError(response, 'VALIDATION_ERROR', 400);
  }
});

test('runs list filters by destination_id and status', async () => {
  const destination = await createDestination(ctx, 'discourse', 'normal');
  const run = (await certify(ctx, destination.id, 'filter-run')).json();
  const url = `/api/v1/certification/runs?destination_id=${destination.id}&status=${run.status}`;
  const response = await ctx.app.inject({ method: 'GET', url });
  expect(response.statusCode).toBe(200);
  expect(response.json().map((row) => row.id)).toContain(run.id);
});

test('certify without Idempotency-Key returns 400 IDEMPOTENCY_KEY_REQUIRED', async () => {
  const destination = await createDestination(ctx, 'discourse', 'normal');
  const response = await ctx.app.inject({
    method: 'POST',
    url: `/api/v1/destinations/${destination.id}/certify`
  });
  expectError(response, 'IDEMPOTENCY_KEY_REQUIRED', 400);
});

test('certification routes require the bearer token when API_TOKEN is set', async () => {
  const secured = await createContext({ apiToken: 'test-api-token' });
  try {
    const response = await secured.app.inject({ method: 'GET', url: '/api/v1/certification/runs' });
    expectError(response, 'UNAUTHORIZED', 401);
  } finally {
    await secured.close();
  }
});
