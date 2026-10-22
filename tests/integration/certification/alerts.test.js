/**
 * Covers certification alert filters and acknowledgement persistence through the API.
 * Alert rows are inserted through the repository shape used by failed certifications.
 */
const { createContext, reset, createDestination } = require('./helpers');

let ctx;

beforeAll(async () => { ctx = await createContext(); });
beforeEach(async () => { await reset(ctx); });
afterAll(async () => { await ctx.close(); });

test('alerts list filters by destination and acknowledged', async () => {
  const first = await createDestination(ctx, 'discourse', 'normal');
  const second = await createDestination(ctx, 'discourse', 'unavailable');
  await ctx.knex('destination_alerts').insert([
    { destination_id: first.id, kind: 'certification_failed', message: 'first' },
    {
      destination_id: second.id,
      kind: 'certification_failed',
      message: 'second',
      acknowledged: true
    }
  ]);
  const url = `/api/v1/alerts?destination_id=${first.id}&acknowledged=false`;
  const response = await ctx.app.inject({ method: 'GET', url });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toHaveLength(1);
  expect(response.json()[0].destination_id).toBe(first.id);
});

test('acknowledge sets acknowledged', async () => {
  const destination = await createDestination(ctx, 'discourse', 'normal');
  const [alert] = await ctx.knex('destination_alerts')
    .insert({
      destination_id: destination.id,
      kind: 'certification_failed',
      message: 'failed'
    })
    .returning('*');
  const response = await ctx.app.inject({
    method: 'POST',
    url: `/api/v1/alerts/${alert.id}/acknowledge`,
    headers: { 'idempotency-key': 'ack-alert' }
  });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual(expect.objectContaining({
    acknowledged: true,
    acknowledged_at: expect.any(String)
  }));
});

test('acknowledge unknown alert returns 404 NOT_FOUND', async () => {
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/v1/alerts/00000000-0000-0000-0000-000000000000/acknowledge',
    headers: { 'idempotency-key': 'missing-alert' }
  });
  expect(response.statusCode).toBe(404);
  expect(response.json().error.code).toBe('NOT_FOUND');
});
