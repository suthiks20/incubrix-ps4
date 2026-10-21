/**
 * Rejects secret material inside a destination's public configuration object.
 * Connection values belong in a secret store referenced by connection_ref.
 */
const AppError = require('../../../shared/errors/AppError');
const SECRET_KEYS = new Set(['token', 'secret', 'password', 'api_key', 'apikey', 'access_token', 'refresh_token', 'authorization']);

function assertNoSecretKeys(value) {
  const fields = [];
  function visit(item, path) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    Object.entries(item).forEach(([key, child]) => {
      const keyPath = path ? `${path}.${key}` : key;
      if (SECRET_KEYS.has(key.toLowerCase())) fields.push({ path: keyPath, message: 'must not contain secret values' });
      else visit(child, keyPath);
    });
  }
  visit(value, 'config');
  if (fields.length) throw new AppError('VALIDATION_ERROR', 'Configuration contains secret fields', { statusCode: 400, details: { fields } });
}

module.exports = assertNoSecretKeys;
