/**
 * Applies a partial destination update and rechecks URL and config safety.
 * Duplicate checks include the existing values when only one key changes.
 */
const AppError = require('../../../shared/errors/AppError');
const normalizeUrl = require('../commons/normalizeUrl');
const assertNoSecretKeys = require('../commons/secretKeys');
const repository = require('../repository/destinations');
const { duplicateError } = require('./create');

async function update(knex, id, changes) {
  const current = await repository.findById(knex, id);
  if (!current) throw new AppError('NOT_FOUND', 'Destination not found', { statusCode: 404 });
  const data = { ...changes };
  if (Object.hasOwn(changes, 'config')) assertNoSecretKeys(changes.config);
  if (Object.hasOwn(changes, 'url')) data.url_normalized = normalizeUrl(changes.url);
  if (Object.hasOwn(changes, 'url') || Object.hasOwn(changes, 'platform_key')) {
    const platformKey = changes.platform_key || current.platform_key;
    const urlNormalized = data.url_normalized || current.url_normalized;
    const existing = await repository.findByPlatformAndUrl(knex, platformKey, urlNormalized);
    if (existing && existing.id !== id) throw duplicateError(existing.id);
  }
  try {
    return await repository.updateById(knex, id, data);
  } catch (error) {
    if (error.code === '23505') throw duplicateError();
    throw error;
  }
}

module.exports = { update };
