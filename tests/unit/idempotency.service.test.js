/**
 * Exercises idempotency ownership and replay decisions against an in-memory repository.
 * No database or network is required for these service tests.
 */
const repository = require('../../src/shared/idempotency/repository');
const service = require('../../src/shared/idempotency/service');
const { setTimeout } = require('timers');

let row;
let claimCount;
const identity = { key: 'test-key', method: 'POST', path: '/api/v1/example' };
const settings = { IDEMPOTENCY_TTL_HOURS: 1, IDEMPOTENCY_WAIT_MS: 100, IDEMPOTENCY_LOCK_TTL_SECONDS: 60 };
function makeRow(state = 'in_progress', hash = 'hash') {
  return { ...identity, request_hash: hash, state, created_at: new Date(), updated_at: new Date(), expires_at: new Date(Date.now() + 60000), response_status: 201, response_body: { id: 'one' }, response_content_type: 'application/json' };
}
function configureFakeRepository() {
  jest.spyOn(repository, 'claim').mockImplementation(async (_knex, values) => {
    claimCount += 1;
    if (row) return null;
    row = makeRow('in_progress', values.requestHash);
    row.expires_at = values.expiresAt;
    return row;
  });
  jest.spyOn(repository, 'find').mockImplementation(async () => row);
  jest.spyOn(repository, 'deleteIfStale').mockImplementation(async () => { row = null; return true; });
  jest.spyOn(repository, 'complete').mockImplementation(async (_knex, _key, _method, _path, response) => {
    Object.assign(row, { state: 'completed', response_status: response.status, response_body: response.body, response_content_type: response.contentType });
  });
  jest.spyOn(repository, 'release').mockImplementation(async () => { row = null; });
}
beforeEach(() => { row = null; claimCount = 0; configureFakeRepository(); });
afterEach(() => jest.restoreAllMocks());

test('claims a fresh key for this request', async () => {
  await expect(service.begin({}, settings, { ...identity, requestHash: 'hash' })).resolves.toEqual({ action: 'proceed' });
});
test('replays a completed row with the same hash', async () => {
  row = makeRow('completed');
  await expect(service.begin({}, settings, { ...identity, requestHash: 'hash' })).resolves.toMatchObject({ action: 'replay', row });
});
test('rejects a different request hash', async () => {
  row = makeRow('completed');
  await expect(service.begin({}, settings, { ...identity, requestHash: 'other' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_CONFLICT', statusCode: 409 });
});
test('waits for an in-progress request and then replays it', async () => {
  row = makeRow();
  setTimeout(() => { row.state = 'completed'; }, 20);
  await expect(service.begin({}, settings, { ...identity, requestHash: 'hash' })).resolves.toMatchObject({ action: 'replay' });
});
test('returns retryable in-progress error at the wait deadline', async () => {
  row = makeRow();
  await expect(service.begin({}, { ...settings, IDEMPOTENCY_WAIT_MS: 10 }, { ...identity, requestHash: 'hash' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS', retryable: true, details: { retry_after_ms: 10 } });
});
test('reclaims an abandoned stale claim', async () => {
  row = makeRow();
  row.updated_at = new Date(Date.now() - 120000);
  await expect(service.begin({}, settings, { ...identity, requestHash: 'hash' })).resolves.toEqual({ action: 'proceed' });
  expect(claimCount).toBe(2);
});
test('finish releases server failures and completes client responses', async () => {
  row = makeRow();
  await service.finish({}, identity, { statusCode: 500, body: {}, contentType: 'application/json' });
  expect(repository.release).toHaveBeenCalled();
  row = makeRow();
  await service.finish({}, identity, { statusCode: 201, body: { id: 1 }, contentType: 'application/json' });
  await service.finish({}, identity, { statusCode: 409, body: { error: {} }, contentType: 'application/json' });
  expect(repository.complete).toHaveBeenCalledTimes(2);
});
