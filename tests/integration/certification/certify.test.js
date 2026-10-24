/**
 * Proves the passing certification path for each connector tier against the in-process mocks.
 * Failure paths, retries and recertification are covered in the later certification test files.
 */
const { createContext, reset, createDestination, certify, mockState } = require('./helpers');

const SIX_STEPS = ['validate', 'publish', 'confirm_live', 'read_status', 'delete', 'verify_gone'];
let ctx;

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

function publish(destinationId, idempotencyKey) {
  return ctx.app.inject({
    method: 'POST',
    url: '/connector/v1/discourse/publish',
    payload: {
      destination_id: destinationId,
      idempotency_key: idempotencyKey,
      rendition: { title: 'A sufficiently long title', body: 'A useful community update.' }
    }
  });
}

beforeAll(async () => {
  ctx = await createContext();
});
beforeEach(async () => {
  await reset(ctx);
});
afterAll(async () => {
  await ctx.close();
});

test('certifies a Discourse destination with six passed steps and an empty mock', async () => {
  const destination = await createDestination(ctx, 'discourse', 'normal');
  const response = await certify(ctx, destination.id, 'cert-discourse-1');
  expect(response.statusCode).toBe(200);
  const run = response.json();
  expect(run.status).toBe('passed');
  expect(run.level_awarded).toBe('L3');
  expect(run.steps.map((step) => step.name)).toEqual(SIX_STEPS);
  expect(run.steps.every((step) => step.status === 'passed')).toBe(true);
  const row = await ctx.knex('destinations').where({ id: destination.id }).first();
  expect(row.level).toBe('L3');
  expect(row.last_certified_at).not.toBeNull();
  expect(row.demoted).toBe(false);
  expect((await mockState(ctx, 'discourse', 'normal')).posts).toHaveLength(0);
  const evidence = await ctx.app.inject(run.evidence_link);
  expect(evidence.statusCode).toBe(200);
  expect(evidence.body).not.toContain('sim-key');
  expect(evidence.body).not.toContain('sim-user');
});

test('certifies a webhook destination', async () => {
  const destination = await createDestination(ctx, 'webhook', 'normal');
  const response = await certify(ctx, destination.id, 'cert-webhook-1');
  expect(response.statusCode).toBe(200);
  const run = response.json();
  expect(run.status).toBe('passed');
  expect(run.level_awarded).toBe('L3');
  expect((await mockState(ctx, 'webhook', 'normal')).posts).toHaveLength(0);
});

test('mrss passes certification against its mock', async () => {
  const destination = await createDestination(ctx, 'mrss', 'normal');
  const response = await certify(ctx, destination.id, 'cert-mrss-1');
  expect(response.statusCode).toBe(200);
  const run = response.json();
  expect(run.status).toBe('passed');
  expect(run.level_awarded).toBe('L2');
  expect(run.steps.map((step) => step.name)).toEqual(SIX_STEPS);
  expect(run.steps.every((step) => step.status === 'passed')).toBe(true);
  expect((await mockState(ctx, 'mrss', 'normal')).posts).toHaveLength(0);
});

test('certifies an assisted destination as L1 with no network calls', async () => {
  const destination = await ctx.knex('destinations').insert({
    name: 'Assisted forum',
    url: 'https://assisted.example.com',
    url_normalized: 'https://assisted.example.com',
    platform_key: 'assisted',
    connector_key: 'assisted',
    automation_allowed: false,
    config: JSON.stringify({ submit_url: 'https://assisted.example.com/submit' })
  }).returning('*').then((rows) => rows[0]);
  const fetchSpy = jest.spyOn(global, 'fetch');
  const response = await certify(ctx, destination.id, 'cert-assisted-1');
  const calls = fetchSpy.mock.calls.length;
  fetchSpy.mockRestore();
  expect(response.statusCode).toBe(200);
  const run = response.json();
  expect(run.status).toBe('passed');
  expect(run.level_awarded).toBe('L1');
  expect(run.steps.filter((step) => step.status === 'skipped')).toHaveLength(5);
  expect(calls).toBe(0);
});

test('HARD CASE certification refuses a non-sandbox host', async () => {
  const destination = await createDestination(ctx, 'discourse', 'normal', {
    url: 'https://outside.example.test',
    url_normalized: 'https://outside.example.test',
    config: JSON.stringify({ base_url: 'https://outside.example.test' })
  });
  const response = await certify(ctx, destination.id, 'cert-host-refused');
  expectError(response, 'CERT_HOST_NOT_ALLOWED', 409);
  expect((await mockState(ctx, 'discourse', 'normal')).post_attempts).toBe(0);
  expect(await ctx.knex('certification_runs').where({ destination_id: destination.id })).toHaveLength(0);
  const row = await ctx.knex('destinations').where({ id: destination.id }).first();
  expect(row.level).toBe('L0');
});

test('certification does not count toward the frequency cap', async () => {
  const destination = await createDestination(ctx, 'discourse', 'normal', {
    frequency_cap: { posts: 1, per_days: 1 }
  });
  expect((await certify(ctx, destination.id, 'cert-cap-1')).statusCode).toBe(200);
  expect((await publish(destination.id, 'publish-after-certification')).statusCode).toBe(200);
});

test(
  'HARD CASE certification retry with the same idempotency key does not publish a second test post',
  async () => {
    const destination = await createDestination(ctx, 'discourse', 'normal');
    const first = await certify(ctx, destination.id, 'cert-replay-1');
    const second = await certify(ctx, destination.id, 'cert-replay-1');
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.headers['idempotent-replay']).toBe('true');
    expect(second.json().id).toBe(first.json().id);
    const state = await mockState(ctx, 'discourse', 'normal');
    expect(state.posts.length).toBeLessThanOrEqual(1);
    expect(state.post_attempts).toBe(1);
  }
);

test('recertification keeps the level and refreshes last_certified_at', async () => {
  let currentTime = new Date('2026-10-22T10:00:00.000Z');
  const timed = await createContext({ now: () => currentTime });
  try {
    await reset(timed);
    const destination = await createDestination(timed, 'discourse', 'normal');
    await certify(timed, destination.id, 'cert-timed-first');
    const first = await timed.knex('destinations').where({ id: destination.id }).first();
    currentTime = new Date('2026-10-22T10:05:00.000Z');
    await certify(timed, destination.id, 'cert-timed-second');
    const second = await timed.knex('destinations').where({ id: destination.id }).first();
    expect(first.level).toBe('L3');
    expect(second.level).toBe('L3');
    expect(new Date(second.last_certified_at).getTime()).toBeGreaterThan(
      new Date(first.last_certified_at).getTime()
    );
  } finally {
    await timed.close();
  }
});

test('run record stores its steps and GET run by id returns them', async () => {
  const destination = await createDestination(ctx, 'discourse', 'normal');
  const certified = await certify(ctx, destination.id, 'cert-steps-read');
  const response = await ctx.app.inject(`/api/v1/certification/runs/${certified.json().id}`);
  expect(response.statusCode).toBe(200);
  expect(response.json().steps).toHaveLength(6);
  for (const step of response.json().steps) {
    expect(step).toEqual(expect.objectContaining({
      name: expect.any(String),
      status: expect.any(String),
      started_at: expect.any(String),
      duration_ms: expect.any(Number),
      summary: expect.any(String)
    }));
  }
});
