/**
 * Registers the one error-envelope format used by every HTTP failure.
 * Unexpected errors are logged server-side without exposing internals.
 */
const AppError = require('./AppError');
const codes = require('./codes');

function send(reply, statusCode, code, message, retryable, details) {
  return reply.status(statusCode).send({ error: { code, message, retryable, details } });
}

function validationFields(validation) {
  return validation.map((item) => ({ path: item.instancePath || item.params?.missingProperty || '', message: item.message }));
}

function registerErrorHandlers(app) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) return send(reply, error.statusCode, error.code, error.message, error.retryable, error.details);
    if (error.validation || error.code === 'FST_ERR_CTP_INVALID_JSON_BODY') {
      const details = error.validation ? { fields: validationFields(error.validation) } : { fields: [{ path: '', message: 'must be valid JSON' }] };
      return send(reply, 400, 'VALIDATION_ERROR', 'Request validation failed', false, details);
    }
    request.log.error({ err: error }, 'Unhandled request error');
    return send(reply, 500, 'INTERNAL_ERROR', 'An unexpected error occurred', false, {});
  });
  app.setNotFoundHandler((_request, reply) => send(reply, codes.NOT_FOUND.statusCode, 'NOT_FOUND', 'Route not found', false, {}));
}

module.exports = registerErrorHandlers;
