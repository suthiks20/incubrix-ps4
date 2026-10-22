/**
 * Represents an expected application failure with safe client details.
 * Error handling turns this object into the standard API error envelope.
 */
interface AppErrorOptions {
  statusCode?: number;
  retryable?: boolean;
  details?: Record<string, any>;
}

class AppError extends Error {
  code: string;
  statusCode: number;
  retryable: boolean;
  details: Record<string, any>;

  constructor(code: string, message: string, { statusCode = 500, retryable = false, details = {} }: AppErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.details = details;
  }
}

export = AppError;
