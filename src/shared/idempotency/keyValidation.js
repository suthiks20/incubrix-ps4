/**
 * Validates the client-provided idempotency key before a POST is processed.
 * Invalid keys use the same public error envelope as other request validation failures.
 */
const AppError = require('../errors/AppError');

function assertValidKey(value) {
  if (value === undefined || value === null || value === '') {
    throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required', { statusCode: 400 });
  }
  if (typeof value !== 'string' || value.length > 255 || !/^[\x20-\x7E]+$/.test(value)) {
    throw new AppError('VALIDATION_ERROR', 'Idempotency-Key header is invalid', {
      statusCode: 400,
      details: { fields: [{ path: 'Idempotency-Key', message: 'must be 1-255 printable ASCII characters' }] }
    });
  }
  return value;
}

module.exports = { assertValidKey };
