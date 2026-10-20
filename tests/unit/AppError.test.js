/**
 * Confirms AppError preserves supplied API fields and sensible defaults.
 * Services rely on this predictable object for expected failures.
 */
const AppError = require('../../src/shared/errors/AppError');
test('sets supplied fields', () => {
  const error = new AppError('EXAMPLE', 'Example message', { statusCode: 418, retryable: true, details: { value: 1 } });
  expect(error).toMatchObject({ code: 'EXAMPLE', message: 'Example message', statusCode: 418, retryable: true, details: { value: 1 } });
});
test('uses defaults', () => expect(new AppError('EXAMPLE', 'Example message')).toMatchObject({ statusCode: 500, retryable: false, details: {} }));
