/**
 * Lists and acknowledges certification alerts using stable not-found errors.
 * It deliberately exposes no connection or evidence secret material.
 */
const AppError = require('../../../shared/errors/AppError'); const repository = require('../alertsRepository');
function list(knex, filters) { return repository.findAll(knex, filters); }
async function acknowledge(knex, id) { const row = await repository.acknowledge(knex, id); if (!row) throw new AppError('NOT_FOUND', 'Alert not found', { statusCode: 404 }); return row; }
module.exports = { list, acknowledge };
