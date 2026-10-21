/**
 * Tests the publish ledger's decisions with a small in-memory repository fake.
 * These cases isolate retries and reconciliation from PostgreSQL and the network.
 */
jest.mock('../../src/modules/ledger/repository', () => ({
  claim: jest.fn(),
  find: jest.fn(),
  update: jest.fn()
}));

const repository = require('../../src/modules/ledger/repository');
const service = require('../../src/modules/ledger/service');
const AppError = require('../../src/shared/errors/AppError');
const { requestHash } = require('../../src/shared/idempotency/hash');

let rows;
const key = 'ledger-test-1';
const rendition = { title: 'A useful title', body: 'Some forum copy' };
const destination = { config: { base_url: 'https://forum.example/' } };
const normalized = 'https://forum.example';
const connector = () => ({
  key: 'discourse',
  publish: jest.fn(async () => ({ platform_post_id: '21', live_url: 'https://forum.example/t/example/21' })),
  findByMarker: jest.fn(async () => null)
});
function expectedHash(content = rendition) { return requestHash('POST', normalized, {}, content); }
function storedRow(state, extra = {}, content = rendition) {
  return {
    connector_key: 'discourse', idempotency_key: key, destination_ref: normalized,
    request_hash: expectedHash(content), marker: 'marker-1', state,
    platform_post_id: state === 'published' ? 'stored-7' : null,
    live_url: state === 'published' ? 'https://forum.example/t/stored/7' : null,
    ...extra
  };
}

beforeEach(() => {
  rows = new Map();
  jest.clearAllMocks();
  repository.claim.mockImplementation(async (_knex, data) => {
    const rowKey = `${data.connector_key}:${data.idempotency_key}`;
    if (rows.has(rowKey)) return null;
    const row = { ...data };
    rows.set(rowKey, row);
    return row;
  });
  repository.find.mockImplementation(async (_knex, connectorKey, idempotencyKey) => rows.get(`${connectorKey}:${idempotencyKey}`) || null);
  repository.update.mockImplementation(async (_knex, connectorKey, idempotencyKey, values) => {
    const row = rows.get(`${connectorKey}:${idempotencyKey}`);
    Object.assign(row, values);
    return row;
  });
});

test('new key inserts in_flight before publishing', async () => {
  const platform = connector();
  const result = await service.publish({}, platform, rendition, destination, {}, key);
  expect(repository.claim.mock.calls[0][1]).toMatchObject({ state: 'in_flight', request_hash: expectedHash() });
  expect(platform.publish).toHaveBeenCalledTimes(1);
  expect(result).toMatchObject({ platform_post_id: '21', status: 'published', replay: false });
});

test('published row returns its stored result without calling the connector', async () => {
  rows.set('discourse:ledger-test-1', storedRow('published'));
  repository.claim.mockResolvedValue(null);
  const platform = connector();
  const result = await service.publish({}, platform, rendition, destination, {}, key);
  expect(result).toMatchObject({ platform_post_id: 'stored-7', live_url: 'https://forum.example/t/stored/7', replay: true });
  expect(platform.publish).not.toHaveBeenCalled();
  expect(platform.findByMarker).not.toHaveBeenCalled();
});

test('unknown row reconciles by marker and returns the found post without publishing', async () => {
  rows.set('discourse:ledger-test-1', storedRow('unknown'));
  repository.claim.mockResolvedValue(null);
  const platform = connector();
  platform.findByMarker.mockResolvedValue({ platform_post_id: '34', live_url: 'https://forum.example/t/found/34' });
  const result = await service.publish({}, platform, rendition, destination, {}, key);
  expect(platform.findByMarker).toHaveBeenCalledTimes(1);
  expect(platform.publish).not.toHaveBeenCalled();
  expect(result).toMatchObject({ platform_post_id: '34', replay: true });
  expect(rows.get('discourse:ledger-test-1').state).toBe('published');
});

test('unknown row with no marker match publishes again', async () => {
  rows.set('discourse:ledger-test-1', storedRow('unknown'));
  repository.claim.mockResolvedValue(null);
  const platform = connector();
  await service.publish({}, platform, rendition, destination, {}, key);
  expect(platform.findByMarker).toHaveBeenCalledTimes(1);
  expect(platform.publish).toHaveBeenCalledTimes(1);
});

test('failed row publishes again', async () => {
  rows.set('discourse:ledger-test-1', storedRow('failed'));
  repository.claim.mockResolvedValue(null);
  const platform = connector();
  await service.publish({}, platform, rendition, destination, {}, key);
  expect(platform.findByMarker).not.toHaveBeenCalled();
  expect(platform.publish).toHaveBeenCalledTimes(1);
});

test('different request hash throws IDEMPOTENCY_KEY_CONFLICT', async () => {
  const changed = { ...rendition, body: 'Different content' };
  rows.set('discourse:ledger-test-1', storedRow('published', {}, changed));
  repository.claim.mockResolvedValue(null);
  await expect(service.publish({}, connector(), rendition, destination, {}, key)).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_CONFLICT', statusCode: 409 });
});

test('a timeout marks the ledger row unknown', async () => {
  const platform = connector();
  platform.publish.mockRejectedValue(new AppError('PLATFORM_UNAVAILABLE', 'Request to the platform timed out or the connection dropped', { statusCode: 503, retryable: true }));
  await expect(service.publish({}, platform, rendition, destination, {}, key)).rejects.toMatchObject({ code: 'PLATFORM_UNAVAILABLE', details: { ledger_state: 'unknown', action: expect.any(String) } });
  expect(rows.get('discourse:ledger-test-1')).toMatchObject({ state: 'unknown', error_code: 'PLATFORM_UNAVAILABLE' });
});

test('a non-timeout AppError marks the ledger row failed with its code', async () => {
  const platform = connector();
  platform.publish.mockRejectedValue(new AppError('PLATFORM_CONTENT_REJECTED', 'Post rejected', { statusCode: 422 }));
  await expect(service.publish({}, platform, rendition, destination, {}, key)).rejects.toMatchObject({ code: 'PLATFORM_CONTENT_REJECTED' });
  expect(rows.get('discourse:ledger-test-1')).toMatchObject({ state: 'failed', error_code: 'PLATFORM_CONTENT_REJECTED' });
});
