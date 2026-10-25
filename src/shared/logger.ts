/**
 * Provides Fastify/Pino logger options with consistent, safe JSON output.
 * Redaction protects credentials even when they are nested in logged objects.
 */
import config = require('../config');

const loggerOptions = {
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
      'req.headers.api-key',
      'req.headers.api-username',
      'req.body.connection',
      'req.body.connection.api_key',
      'req.body.connection.api_username',
      'req.body.connection.signing_secret',
      'req.body.connection.password',
      'req.body.connection.admin_api_key',
      'GEMINI_API_KEY',
      'GROQ_API_KEY',
      'apiKey',
      '*.GEMINI_API_KEY',
      '*.GROQ_API_KEY',
      '**.GEMINI_API_KEY',
      '**.GROQ_API_KEY',
      'token',
      'secret',
      'password',
      'api_key',
      'access_token',
      'refresh_token',
      'connection',
      '*.api_key',
      '*.api_username',
      '**.api_key',
      '**.api_username',
      'password',
      '*.password',
      '**.password',
      'admin_api_key',
      '*.admin_api_key',
      '**.admin_api_key',
      'signing_secret',
      '*.signing_secret',
      '**.signing_secret'
    ],
    censor: '[REDACTED]'
  }
};

export = loggerOptions;
