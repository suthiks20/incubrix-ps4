/**
 * Proves certification never persists or logs connection values from environment resolution.
 * It exercises both a passing platform run and a schema-drift failure against local mocks.
 */
const { PassThrough } = require('stream');
const pino = require('pino');
const loggerOptions = require('../../../src/shared/logger');
const { createContext, reset, createDestination, certify } = require('./helpers');

const secrets = {
  api_key: 'cert-secret-api-key-unique',
  api_username: 'cert-secret-user-unique',
  signing_secret: 'cert-secret-signing-unique'
};
const environmentName = 'CONNECTION_CERT_PRIMARY';
let ctx;
let logs;
let stream;

function containsSecret(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return Object.values(secrets).some((secret) => text.includes(secret));
}

async function evidenceContents() {
  const keys = await ctx.app.storage.list('certification/');
  return Promise.all(keys.map(async (key) => (await ctx.app.storage.get(key)).toString()));
}

beforeAll(async () => {
  logs = '';
  stream = new PassThrough();
  stream.on('data', (chunk) => { logs += chunk.toString(); });
  process.env[environmentName] = JSON.stringify(secrets);
  const logger = pino({ ...loggerOptions, level: 'info' }, stream);
  ctx = await createContext({ logger });
});
beforeEach(async () => {
  logs = '';
  await reset(ctx);
});
afterAll(async () => {
  delete process.env[environmentName];
  stream.end();
  await ctx.close();
});

test('certification never leaks connection secrets', async () => {
  const options = { connection_ref: 'cert-primary' };
  const passing = await createDestination(ctx, 'discourse', 'normal', options);
  const failing = await createDestination(ctx, 'discourse', 'renamed_field', options);
  const passResponse = await certify(ctx, passing.id, 'cert-secret-pass');
  const failResponse = await certify(ctx, failing.id, 'cert-secret-fail');
  expect(passResponse.statusCode).toBe(200);
  expect(failResponse.statusCode).toBe(200);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const runs = await ctx.knex('certification_runs').select('*');
  const alerts = await ctx.knex('destination_alerts').select('*');
  const evidence = await evidenceContents();
  expect(containsSecret(logs)).toBe(false);
  expect(containsSecret(passResponse.body)).toBe(false);
  expect(containsSecret(failResponse.body)).toBe(false);
  expect(containsSecret(runs)).toBe(false);
  expect(containsSecret(alerts)).toBe(false);
  expect(evidence).toHaveLength(2);
  for (const file of evidence) expect(containsSecret(file)).toBe(false);
});
