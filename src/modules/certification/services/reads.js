/**
 * Loads certification runs and evidence while enforcing service-level not-found errors.
 * Handlers use these functions so missing rows always return the common error envelope.
 */
const AppError = require('../../../shared/errors/AppError');
const runs = require('../repository/runs');

async function getRun(knex, id) {
  const run = await runs.findById(knex, id);
  if (!run) throw new AppError('NOT_FOUND', 'Certification run not found', { statusCode: 404 });
  return run;
}

async function getEvidence(knex, storage, id) {
  const run = await getRun(knex, id);
  const file = await storage.get(run.evidence_key);
  return JSON.parse(file.toString());
}

module.exports = { getRun, getEvidence };
