/**
 * Registers the one error-envelope format used by every HTTP failure.
 * Unexpected errors are logged server-side without exposing internals.
 */
import AppError = require('./AppError');
import codes = require('./codes');

function send(reply: any, statusCode: number, code: string, message: string, retryable: boolean, details: any) {
  return reply.status(statusCode).send({ error: { code, message, retryable, details } });
}

function validationFields(validation: any[]): Array<{ path: string; message: string }> {
  return validation.map((item) => ({ path: item.instancePath || item.params?.missingProperty || '', message: item.message }));
}

function registerErrorHandlers(app: any): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      if (error.code === 'PLATFORM_RATE_LIMIT' && error.details.retry_after_seconds !== undefined) reply.header('Retry-After', String(error.details.retry_after_seconds));
      return send(reply, error.statusCode, error.code, error.message, error.retryable, error.details);
    }
    if (error.validation && request.headers['content-type']?.split(';')[0].trim().toLowerCase() === 'text/plain') {
      return send(reply, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Request content type is not supported', false, {});
    }
    if (error.validation || error.code === 'FST_ERR_CTP_INVALID_JSON_BODY') {
      const details = error.validation ? { fields: validationFields(error.validation) } : { fields: [{ path: '', message: 'must be valid JSON' }] };
      return send(reply, 400, 'VALIDATION_ERROR', 'Request validation failed', false, details);
    }
    if (Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode <= 499) {
      const code = error.statusCode === 415 ? 'UNSUPPORTED_MEDIA_TYPE' : error.statusCode === 413 ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR';
      const message = code === 'UNSUPPORTED_MEDIA_TYPE' ? 'Request content type is not supported' : code === 'PAYLOAD_TOO_LARGE' ? 'Request body is too large' : 'Request could not be processed';
      return send(reply, error.statusCode, code, message, false, {});
    }
    request.log.error({ err: error }, 'Unhandled request error');
    return send(reply, 500, 'INTERNAL_ERROR', 'An unexpected error occurred', false, {});
  });
  app.setNotFoundHandler((_request, reply) => send(reply, codes.NOT_FOUND.statusCode, 'NOT_FOUND', 'Route not found', false, {}));
}

export = registerErrorHandlers;
