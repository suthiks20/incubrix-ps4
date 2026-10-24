/**
 * Saves the result of one certification run: the run row, the destination state and any alert.
 * Only certification code changes a destination's level, last_certified_at and demoted flag.
 */
const runs = require('../repository/runs');
const alerts = require('../repository/alerts');
const destinations = require('../../destinations/repository/destinations');
const { levelFor } = require('../commons/constants');

function baseRow(result) {
  const post = result.post;
  return {
    id: result.runId,
    destination_id: result.destination.id,
    connector_key: result.connectorKey,
    platform_post_id: post ? post.platform_post_id : null,
    live_url: post ? post.live_url : null,
    ...failedRunValues(result),
    evidence_key: result.evidenceKey,
    steps: JSON.stringify(result.steps),
    started_at: result.startedAt,
    finished_at: result.finishedAt,
    duration_ms: result.finishedAt - result.startedAt
  };
}

function failedRunValues(result) {
  if (result.deleted) {
    return { status: 'failed', test_post_deleted: true, cleanup_due_at: null };
  }
  if (result.cleanup_due_at) {
    return { status: 'cleanup_pending', test_post_deleted: false, cleanup_due_at: result.cleanup_due_at };
  }
  return { status: 'failed', test_post_deleted: false, cleanup_due_at: null };
}

async function recordPassed(deps, result) {
  const level = levelFor(result.tier);
  const row = await runs.insert(deps.knex, { ...baseRow(result), status: 'passed', level_awarded: level });
  await destinations.updateCertification(deps.knex, result.destination.id, {
    level,
    last_certified_at: result.finishedAt,
    demoted: false
  });
  return row;
}

async function recordFailed(deps, result, error) {
  const code = error.code || 'INTERNAL_ERROR';
  const failedStep = result.steps.find((step) => step.status === 'failed');
  const failureStep = failedStep ? failedStep.name : 'certification';
  const failedValues = failedRunValues(result);
  const row = await runs.insert(deps.knex, {
    ...baseRow(result),
    ...failedValues,
    failure_code: code,
    failure_step: failureStep,
    failure_message: error.message
  });
  await destinations.updateCertification(deps.knex, result.destination.id, { demoted: true });
  await alerts.insert(deps.knex, {
    destination_id: result.destination.id,
    kind: code === 'SCHEMA_DRIFT' ? 'schema_drift' : 'certification_failed',
    message: error.message,
    run_id: result.runId,
    details: { code, failure_step: failureStep, run_id: result.runId }
  });
  deps.logger.warn({ destination_id: result.destination.id, code }, 'Certification failed');
  return row;
}

async function restoreDestinationState(knex, destinationId, state) {
  return destinations.updateCertification(knex, destinationId, {
    level: state.level,
    last_certified_at: state.last_certified_at,
    demoted: state.demoted
  });
}

module.exports = { recordPassed, recordFailed, failedRunValues, restoreDestinationState };
