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
  code: ErrorCode;
  statusCode: number;
  retryable: boolean;
  details: Record<string, any>;

  constructor(code: ErrorCode, message: string, { statusCode = 500, retryable = false, details = {} }: AppErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.details = details;
  }
}

export = AppError;
import type { ErrorCode } from '../../modules/connectors/types';

