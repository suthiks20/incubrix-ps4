/**
 * Ensures connector credentials cannot leak through logs, API envelopes, or ledger rows.
 * Fake values are deliberately unique so an accidental exposure is unambiguous.
 */
const pino = require('pino'); const { PassThrough } = require('stream'); const buildApp = require('../../src/app'); const loggerOptions = require('../../src/shared/logger'); const { createTestDatabase } = require('./testDatabase');
let app; let knex; let base; let logs = ''; let stream;
beforeAll(async () => { knex = createTestDatabase(); stream = new PassThrough(); stream.on('data', (chunk) => { logs += chunk; }); app = buildApp({ knex, apiToken: '', logger: pino({ ...loggerOptions, level: 'info' }, stream) }); await app.listen({ port: 0, host: '127.0.0.1' }); base = `http://127.0.0.1:${app.server.address().port}/mock`; });
beforeEach(async () => { logs = ''; await knex('publish_ledger').del(); }); afterAll(async () => { await app.close(); await knex.destroy(); stream.end(); });
test('credentials never appear in webhook, Discourse, or failed-publish logs responses or ledger rows', async () => {
  const signing = 'fake-signing-secret-never-log'; const apiKey = 'fake-api-key-never-log'; const username = 'fake-api-user-never-log';
  const webhook = await app.inject({ method: 'POST', url: '/connector/v1/webhook/publish', payload: { idempotency_key: 'secret-webhook', destination_ref: `${base}/webhook/normal`, connection: { signing_secret: signing }, rendition: { title: 'Webhook secret test', body: 'body' } } });
  const discourse = await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: { idempotency_key: 'secret-discourse', destination_ref: `${base}/discourse/normal`, connection: { api_key: apiKey, api_username: username }, rendition: { title: 'A sufficiently long title', body: 'body' } } });
  const failing = await app.inject({ method: 'POST', url: '/connector/v1/discourse/publish', payload: { idempotency_key: 'secret-fail', destination_ref: `${base}/discourse/expired_token`, connection: { api_key: apiKey, api_username: username }, rendition: { title: 'A sufficiently long title', body: 'body' } } });
  await new Promise((resolve) => setTimeout(resolve, 0)); const text = `${logs}${webhook.body}${discourse.body}${failing.body}${JSON.stringify(await knex('publish_ledger'))}`;
  [signing, apiKey, username].forEach((value) => expect(text).not.toContain(value));
});
