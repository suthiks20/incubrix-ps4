/**
 * Proves the passing certification path for each connector tier against the in-process mocks.
 * Failure paths, retries and recertification are covered in the later certification test files.
 */
const { createContext, reset, createDestination, certify, mockState } = require('./helpers');

const SIX_STEPS = ['validate', 'publish', 'confirm_live', 'read_status', 'delete', 'verify_gone'];
let ctx;

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
