/**
 * Validates and creates a destination while preventing duplicate platform URLs.
 * A database unique violation is translated to the same stable conflict error.
 */
const AppError = require('../../../shared/errors/AppError');
const normalizeUrl = require('../commons/normalizeUrl');
const assertNoSecretKeys = require('../commons/secretKeys');
const repository = require('../repository/destinations');

async function create(knex, input) {
  const urlNormalized = normalizeUrl(input.url);
  assertNoSecretKeys(input.config || {});
  const existing = await repository.findByPlatformAndUrl(knex, input.platform_key, urlNormalized);
  if (existing) throw duplicateError(existing.id);
  try {
    return await repository.insert(knex, { ...input, url_normalized: urlNormalized });
  } catch (error) {
    if (error.code === '23505') throw duplicateError();
    throw error;
  }
}

function duplicateError(existingId) {
  return new AppError('DUPLICATE_DESTINATION', 'Destination already exists for this platform', {
    statusCode: 409, details: existingId ? { existing_id: existingId } : {}
  });
}

module.exports = { create, duplicateError };
