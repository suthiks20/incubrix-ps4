/**
 * Shares the real Postgres app harness used by the jobs integration suites.
 * Jobs are cleared independently so every queue assertion begins with one known state.
 */
const { createContext, createDestination } = require('../certification/helpers');

async function resetJobs(ctx) {
  await ctx.knex.raw(
    'TRUNCATE jobs, idempotency_keys, publish_ledger, certification_runs, destination_alerts, destinations CASCADE'
  );
}

function jobPayload(destinationId, extras = {}) {
  return { type: 'certify', input: { destination_id: destinationId }, ...extras };
}

function postJob(ctx, payload, key) {
  const headers = key ? { 'idempotency-key': key } : {};
  return ctx.app.inject({ method: 'POST', url: '/api/v1/jobs', headers, payload });
}

function workerDeps(ctx) {
  return {
    knex: ctx.knex,
    config: ctx.app.config,
    logger: ctx.app.log,
    storage: ctx.app.storage,
    now: () => new Date(),
    connectorFactory: ctx.app.connectorFactory,
    catalogueOptions: ctx.app.catalogueOptions
  };
}

function expectError(response, statusCode, code) {
  expect(response.statusCode).toBe(statusCode);
  expect(response.json()).toEqual(expect.objectContaining({
    error: expect.objectContaining({ code, message: expect.any(String), retryable: expect.any(Boolean), details: expect.any(Object) })
  }));
}

module.exports = {
  createContext,
  resetJobs,
  createDestination,
  jobPayload,
  postJob,
  workerDeps,
  expectError
};
