/**
 * Exercises readiness with fake Knex clients instead of a real database.
 * It verifies the service maps failed pings to the standard AppError.
 */
const { getReady } = require('../../src/modules/health/services/ready');
const AppError = require('../../src/shared/errors/AppError');
const { createKnexMock, createFailingKnexMock } = require('../../src/modules/health/repository/__mocks__/knex.mock');
test('returns ready when the database ping succeeds', async () => {
  await expect(getReady(createKnexMock())).resolves.toEqual({ status: 'ready', checks: { db: 'ok' } });
});
test('throws NOT_READY when the database ping fails', async () => {
  await expect(getReady(createFailingKnexMock())).rejects.toMatchObject({ code: 'NOT_READY', statusCode: 503 });
  await expect(getReady(createFailingKnexMock())).rejects.toBeInstanceOf(AppError);
});
