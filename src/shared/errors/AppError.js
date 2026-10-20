/**
 * Represents an expected application failure with safe client details.
 * Error handling turns this object into the standard API error envelope.
 */
class AppError extends Error {
  constructor(code, message, { statusCode = 500, retryable = false, details = {} } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.details = details;
  }
}

module.exports = AppError;
