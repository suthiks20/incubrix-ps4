/**
 * Checks the required idempotency header format and its public error outcomes.
 * These tests exercise only the shared validation helper.
 */
const { assertValidKey } = require('../../src/shared/idempotency/keyValidation');

test('missing key raises IDEMPOTENCY_KEY_REQUIRED', () => {
  let caught;
  try { assertValidKey(undefined); } catch (error) { caught = error; }
  expect(caught).toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED', statusCode: 400 });
});
test('keys over 255 characters raise validation error', () => {
  let caught;
  try { assertValidKey('a'.repeat(256)); } catch (error) { caught = error; }
  expect(caught).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400, details: { fields: [expect.objectContaining({ path: 'Idempotency-Key' })] } });
});
test('control characters raise validation error', () => {
  let caught;
  try { assertValidKey('bad\nkey'); } catch (error) { caught = error; }
  expect(caught).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
});
test('a printable key passes unchanged', () => {
  expect(assertValidKey('demo-001')).toBe('demo-001');
});
