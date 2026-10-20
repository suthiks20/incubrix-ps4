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

function parseBoolean(name, value) {
  if (value === undefined) return true;
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
    SIMULATION_MODE: parseBoolean('SIMULATION_MODE', env.SIMULATION_MODE)
  });
}

module.exports = loadConfig();
