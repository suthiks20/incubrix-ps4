/**
 * Fetches one destination or raises the shared not-found application error.
 * HTTP handlers remain free of record-existence decisions.
 */
const AppError = require('../../../shared/errors/AppError');
const repository = require('../repository/destinations');

async function getById(knex, id) {
  const destination = await repository.findById(knex, id);
  if (!destination) throw new AppError('NOT_FOUND', 'Destination not found', { statusCode: 404 });
  return destination;
}

module.exports = { getById };
