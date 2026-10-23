/**
 * Exercises readiness with fake Knex clients instead of a real database.
 * It verifies the service maps failed pings to the standard AppError.
 */
const { getReady } = require('../../src/modules/health/services/ready');
const AppError = require('../../src/shared/errors/AppError');
const { createKnexMock, createFailingKnexMock } = require('../../src/modules/health/repository/__mocks__/knex.mock');
const storage = { ready: async () => {} };
test('returns ready when the database ping succeeds', async () => {
  await expect(getReady(createKnexMock(), storage)).resolves.toEqual({ status: 'ready', checks: { db: 'ok', storage: 'ok' } });
});
test('throws NOT_READY when the database ping fails', async () => {
  await expect(getReady(createFailingKnexMock(), storage)).rejects.toMatchObject({ code: 'NOT_READY', statusCode: 503 });
  await expect(getReady(createFailingKnexMock(), storage)).rejects.toBeInstanceOf(AppError);
});
test('reports storage down without exposing implementation details', async () => {
  await expect(getReady(createKnexMock(), { ready: async () => { throw new Error('down'); } })).rejects.toMatchObject({ details: { checks: { db: 'ok', storage: 'down' } } });
});
