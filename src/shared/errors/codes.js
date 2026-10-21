/**
 * Defines stable error codes and their default transport behaviour.
 * Services use these values so API clients get predictable envelopes.
 */
module.exports = Object.freeze({
  DEST_SPEC_VIOLATION: { statusCode: 400, retryable: false },
  DEST_RULE_FREQUENCY_CAP: { statusCode: 429, retryable: true, retry_hint: 'later' },
  CONNECTION_AUTH_EXPIRED: { statusCode: 401, retryable: true, retry_hint: 'after reconnect' },
  PLATFORM_RATE_LIMIT: { statusCode: 429, retryable: true },
  PLATFORM_QUOTA_EXHAUSTED: { statusCode: 429, retryable: true, retry_hint: 'next window' },
  PLATFORM_CONTENT_REJECTED: { statusCode: 422, retryable: false },
  PLATFORM_UNAVAILABLE: { statusCode: 503, retryable: true },
  CONNECTOR_DISABLED: { statusCode: 409, retryable: false },
  VALIDATION_ERROR: { statusCode: 400, retryable: false },
  UNSUPPORTED_MEDIA_TYPE: { statusCode: 415, retryable: false },
  PAYLOAD_TOO_LARGE: { statusCode: 413, retryable: false },
  NOT_FOUND: { statusCode: 404, retryable: false },
  UNAUTHORIZED: { statusCode: 401, retryable: false },
  IDEMPOTENCY_KEY_REQUIRED: { statusCode: 400, retryable: false },
  IDEMPOTENCY_KEY_CONFLICT: { statusCode: 409, retryable: false },
  IDEMPOTENCY_REQUEST_IN_PROGRESS: { statusCode: 409, retryable: true },
  RATE_LIMITED: { statusCode: 429, retryable: false },
  NOT_READY: { statusCode: 503, retryable: false },
  INTERNAL_ERROR: { statusCode: 500, retryable: false },
  CONNECTOR_NOT_IMPLEMENTED: { statusCode: 501, retryable: false },
  DESTINATION_DISABLED: { statusCode: 409, retryable: false },
  DUPLICATE_DESTINATION: { statusCode: 409, retryable: false }
});
