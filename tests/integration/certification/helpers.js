/**
 * Builds an isolated app, database cleanup state, and local evidence storage for certification tests.
 * A real listener keeps in-process mock platforms reachable through connector HTTP requests.
 */
const fs = require('fs/promises'); const os = require('os'); const path = require('path'); const buildApp = require('../../../src/app'); const { createTestDatabase } = require('../testDatabase'); const { createLocal } = require('../../../src/shared/storage/local');
async function createContext(options = {}) { const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ix-cert-')); const knex = createTestDatabase(); const clock = options.now || (() => new Date()); const config = { ...require('../../../src/config'), CERT_ALLOWED_HOSTS: ['127.0.0.1'], STORAGE_DIR: directory }; const app = buildApp({ knex, apiToken: '', config, storage: createLocal(directory), now: clock, connectorFactory: options.connectorFactory }); await app.listen({ port: 0, host: '127.0.0.1' }); return { app, knex, directory, close: async () => { await app.close(); await knex.destroy(); await fs.rm(directory, { recursive: true, force: true }); } }; }
async function reset(knex) { await knex.raw('TRUNCATE destinations, certification_runs, destination_alerts, publish_ledger, idempotency_keys RESTART IDENTITY CASCADE'); }
module.exports = { createContext, reset };
