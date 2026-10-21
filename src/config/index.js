/**
 * Reads and validates all environment settings in one place at startup.
 * Other modules import this frozen object instead of reading process.env.
 */
function requireValue(env, name) {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function parseIntegerSetting(name, value, defaultValue, minimum) {
  if (value === undefined) return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}`);
  }
  return parsed;
}

function parseBoolean(name, value, defaultValue) {
  if (value === undefined) return defaultValue;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

function validateUrl(name, value) {
  try {
    return new URL(value).toString().replace(/\/$/, '');
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}

function loadConfig(env = process.env) {
  return Object.freeze({
    NODE_ENV: env.NODE_ENV || 'development',
    PORT: parsePort(env.PORT || '8000'),
    HOST: env.HOST || '0.0.0.0',
    LOG_LEVEL: env.LOG_LEVEL || 'info',
    DATABASE_URL: requireValue(env, 'DATABASE_URL'),
    PUBLIC_BASE_URL: validateUrl('PUBLIC_BASE_URL', env.PUBLIC_BASE_URL || 'http://localhost:8000'),
    SIMULATION_MODE: parseBoolean('SIMULATION_MODE', env.SIMULATION_MODE, true),
    DB_AUTO_MIGRATE: parseBoolean('DB_AUTO_MIGRATE', env.DB_AUTO_MIGRATE, true),
    API_TOKEN: env.API_TOKEN || '',
    TEST_DATABASE_URL: env.TEST_DATABASE_URL || '',
    IDEMPOTENCY_TTL_HOURS: parseIntegerSetting('IDEMPOTENCY_TTL_HOURS', env.IDEMPOTENCY_TTL_HOURS, 24, 1),
    IDEMPOTENCY_WAIT_MS: parseIntegerSetting('IDEMPOTENCY_WAIT_MS', env.IDEMPOTENCY_WAIT_MS, 5000, 0),
    IDEMPOTENCY_LOCK_TTL_SECONDS: parseIntegerSetting('IDEMPOTENCY_LOCK_TTL_SECONDS', env.IDEMPOTENCY_LOCK_TTL_SECONDS, 60, 1),
    CONNECTOR_HTTP_TIMEOUT_MS: parseIntegerSetting('CONNECTOR_HTTP_TIMEOUT_MS', env.CONNECTOR_HTTP_TIMEOUT_MS, 10000, 1),
    CONNECTOR_MAX_BACKOFF_MS: parseIntegerSetting('CONNECTOR_MAX_BACKOFF_MS', env.CONNECTOR_MAX_BACKOFF_MS, 5000, 0),
    CIRCUIT_FAILURE_THRESHOLD: parseIntegerSetting('CIRCUIT_FAILURE_THRESHOLD', env.CIRCUIT_FAILURE_THRESHOLD, 5, 1),
    CIRCUIT_COOLDOWN_SECONDS: parseIntegerSetting('CIRCUIT_COOLDOWN_SECONDS', env.CIRCUIT_COOLDOWN_SECONDS, 60, 1),
    CERT_TEST_POST_TTL_MINUTES: parseIntegerSetting('CERT_TEST_POST_TTL_MINUTES', env.CERT_TEST_POST_TTL_MINUTES, 10, 1),
    CERT_JANITOR_INTERVAL_SECONDS: parseIntegerSetting('CERT_JANITOR_INTERVAL_SECONDS', env.CERT_JANITOR_INTERVAL_SECONDS, 60, 1),
    CERT_ALLOWED_HOSTS: (env.CERT_ALLOWED_HOSTS || 'localhost,127.0.0.1').split(',').map((host) => host.trim()).filter(Boolean),
    STORAGE_DRIVER: env.STORAGE_DRIVER || 'local',
    STORAGE_DIR: env.STORAGE_DIR || './data/storage',
    SELF_BASE_URL: validateUrl('SELF_BASE_URL', env.SELF_BASE_URL || `http://127.0.0.1:${env.PORT || '8000'}`),
    SEED_DEMO_DESTINATIONS: parseBoolean('SEED_DEMO_DESTINATIONS', env.SEED_DEMO_DESTINATIONS, (env.SIMULATION_MODE === undefined || env.SIMULATION_MODE === 'true')),
    CONNECTORS_DISABLED: (env.CONNECTORS_DISABLED || '').split(',').map((key) => key.trim()).filter(Boolean)
  });
}

module.exports = loadConfig();
