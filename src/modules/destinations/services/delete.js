/**
 * Hard-deletes one destination and reports missing IDs as not found.
 * The service owns the result interpretation for this action.
 */
const AppError = require('../../../shared/errors/AppError');
const repository = require('../repository/destinations');

async function remove(knex, id) {
  const deleted = await repository.deleteById(knex, id);
  if (!deleted) throw new AppError('NOT_FOUND', 'Destination not found', { statusCode: 404 });
  return { deleted: true };
}

module.exports = { remove };
