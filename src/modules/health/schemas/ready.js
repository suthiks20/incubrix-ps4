/**
 * Defines the readiness response contract for database and storage checks.
 * Error envelopes are produced centrally by the shared error handler.
 */
module.exports = {
  response: { 200: { type: 'object', required: ['status', 'checks'], properties: {
    status: { type: 'string' }, checks: { type: 'object', required: ['db', 'storage'], properties: { db: { type: 'string' }, storage: { type: 'string' } } }
  } } }
};
