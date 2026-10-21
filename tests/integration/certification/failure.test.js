/**
 * Proves that a failed certification records every step, demotes the destination and blocks publishing.
 * A platform that renames a field in its API is the hard case from the brief.
 */
const { createContext, reset, createDestination, certify, mockState } = require('./helpers');

let ctx;

beforeAll(async () => {
  ctx = await createContext();
});
beforeEach(async () => {
  await reset(ctx);
});
afterAll(async () => {
  await ctx.close();
});

function publishViaConnector(destinationId, key) {
  return ctx.app.inject({
    method: 'POST',
    url: '/connector/v1/discourse/publish',
    payload: {
      idempotency_key: key,
      destination_id: destinationId,
      rendition: { title: 'A sufficiently long title', body: 'Hello community' }
    }
  });
}

test('HARD CASE renamed field fails certification and demotes the destination', async () => {
  const destination = await createDestination(ctx, 'discourse', 'renamed_field');
  const response = await certify(ctx, destination.id, 'cert-drift-1');
  expect(response.statusCode).toBe(200);
  const run = response.json();
  expect(run.status).toBe('failed');
  expect(run.failure_code).toBe('SCHEMA_DRIFT');
  expect(run.failure_step).toBe('publish');
  const statuses = run.steps.map((step) => `${step.name}:${step.status}`);
  expect(statuses).toEqual([
    'validate:passed',
    'publish:failed',
    'confirm_live:skipped',
    'read_status:skipped',
    'delete:skipped',
    'verify_gone:skipped'
  ]);
  const row = await ctx.knex('destinations').where({ id: destination.id }).first();
  expect(row.demoted).toBe(true);
  expect(row.level).toBe('L0');
  const alerts = await ctx.knex('destination_alerts').where({ destination_id: destination.id });
  expect(alerts).toHaveLength(1);
  expect(alerts[0].kind).toBe('schema_drift');
  const before = (await mockState(ctx, 'discourse', 'renamed_field')).post_attempts;
  const blocked = await publishViaConnector(destination.id, 'blocked-after-drift');
  expect(blocked.statusCode).toBe(409);
  expect(blocked.json().error.code).toBe('DESTINATION_DEMOTED');
  expect((await mockState(ctx, 'discourse', 'renamed_field')).post_attempts).toBe(before);
});

test('HARD CASE recertification clears the demotion', async () => {
  const destination = await createDestination(ctx, 'discourse', 'renamed_field');
  await certify(ctx, destination.id, 'cert-drift-2');
  const fixedUrl = `${ctx.mockRoot}/discourse/normal`;
  await ctx.knex('destinations').where({ id: destination.id })
    .update({ config: JSON.stringify({ base_url: fixedUrl }) });
  const run = (await certify(ctx, destination.id, 'cert-fixed-2')).json();
  expect(run.status).toBe('passed');
  const row = await ctx.knex('destinations').where({ id: destination.id }).first();
  expect(row.demoted).toBe(false);
  expect(row.level).toBe('L3');
  const published = await publishViaConnector(destination.id, 'works-again');
  expect(published.statusCode).toBe(200);
});
