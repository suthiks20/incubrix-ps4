/**
 * Verifies destination POST idempotency against the isolated PostgreSQL test database.
 * Each case clears both destination records and stored idempotency responses.
 */
const { createDestinationContext, destinationInput, postDestination, clearDestinations, expectEnvelope } = require('../destinationTestHelpers');
let context;
beforeAll(async () => { context = await createDestinationContext(); });
afterAll(async () => { await context.app.close(); await context.knex.destroy(); });
beforeEach(async () => clearDestinations(context.knex));

test('requires a key without creating a claim', async () => {
  const response = await context.app.inject({ method: 'POST', url: '/api/v1/destinations', payload: destinationInput() });
  expectEnvelope(response, 'IDEMPOTENCY_KEY_REQUIRED', 400);
  expect(Number((await context.knex('idempotency_keys').count({ total: '*' }).first()).total)).toBe(0);
  expect(Number((await context.knex('destinations').count({ total: '*' }).first()).total)).toBe(0);
});

test('replays an identical request once and stores one destination', async () => {
  const payload = destinationInput();
  const first = await postDestination(context.app, payload, { key: 'same-body' });
  const second = await postDestination(context.app, payload, { key: 'same-body' });
  expect(first.statusCode).toBe(201);
  expect(second.statusCode).toBe(201);
  expect(second.json()).toEqual(first.json());
  expect(first.headers['idempotent-replay']).toBeUndefined();
  expect(second.headers['idempotent-replay']).toBe('true');
  expect(Number((await context.knex('destinations').count({ total: '*' }).first()).total)).toBe(1);
});

test('canonical body key order replays and changed content conflicts', async () => {
  const payload = destinationInput({ config: { alpha: 1, beta: 2 } });
  const first = await postDestination(context.app, payload, { key: 'canonical-body' });
  const reordered = { ...payload, config: { beta: 2, alpha: 1 } };
  const replay = await postDestination(context.app, reordered, { key: 'canonical-body' });
  expect(replay.headers['idempotent-replay']).toBe('true');
  expect(replay.json()).toEqual(first.json());
  const changed = await postDestination(context.app, { ...payload, name: 'Changed name' }, { key: 'canonical-body' });
  expectEnvelope(changed, 'IDEMPOTENCY_KEY_CONFLICT', 409);
  expect(Number((await context.knex('destinations').count({ total: '*' }).first()).total)).toBe(1);
});

test('replays duplicate destination conflicts and validation failures', async () => {
  const original = await postDestination(context.app, destinationInput(), { key: 'original' });
  expect(original.statusCode).toBe(201);
  const duplicatePayload = destinationInput({ name: 'Duplicate attempt' });
  const duplicate = await postDestination(context.app, duplicatePayload, { key: 'duplicate-response' });
  const duplicateReplay = await postDestination(context.app, duplicatePayload, { key: 'duplicate-response' });
  expectEnvelope(duplicate, 'DUPLICATE_DESTINATION', 409);
  expect(duplicateReplay.statusCode).toBe(409);
  expect(duplicateReplay.json()).toEqual(duplicate.json());
  expect(duplicateReplay.headers['idempotent-replay']).toBe('true');

  const invalid = { ...destinationInput() };
  delete invalid.name;
  const failed = await postDestination(context.app, invalid, { key: 'invalid-response' });
  const failedReplay = await postDestination(context.app, invalid, { key: 'invalid-response' });
  expectEnvelope(failed, 'VALIDATION_ERROR', 400);
  expect(failedReplay.statusCode).toBe(400);
  expect(failedReplay.json()).toEqual(failed.json());
  expect(failedReplay.headers['idempotent-replay']).toBe('true');
});

test('simultaneous requests sharing a key produce one destination and one replay', async () => {
  const payload = destinationInput();
  const responses = await Promise.all([
    postDestination(context.app, payload, { key: 'simultaneous-same-key' }),
    postDestination(context.app, payload, { key: 'simultaneous-same-key' })
  ]);
  expect(responses.map((response) => response.statusCode)).toEqual([201, 201]);
  expect(responses[0].json().id).toBe(responses[1].json().id);
  expect(responses.filter((response) => response.headers['idempotent-replay'] === 'true')).toHaveLength(1);
  expect(responses.filter((response) => response.headers['idempotent-replay'] === undefined)).toHaveLength(1);
  expect(Number((await context.knex('destinations').count({ total: '*' }).first()).total)).toBe(1);
});

test('GET and public health routes do not need an idempotency key', async () => {
  expect((await context.app.inject('/api/v1/destinations')).statusCode).toBe(200);
  expect((await context.app.inject('/health')).statusCode).toBe(200);
  expect((await context.app.inject('/api/v1/health')).statusCode).toBe(200);
});
