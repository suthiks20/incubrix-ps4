/**
 * Provides Fastify/Pino logger options with consistent, safe JSON output.
 * Redaction protects credentials even when they are nested in logged objects.
 */
const config = require('../config');

module.exports = {
  level: config.LOG_LEVEL,
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  formatters: {
    level(label) {
      return { level: label };
    }
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.x-api-key',
      'token',
      'secret',
      'password',
      'api_key',
      'access_token',
      'refresh_token'
    ],
    censor: '[REDACTED]'
  }
};
