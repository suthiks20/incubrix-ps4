/**
 * Verifies startup configuration rejects missing required values and applies defaults.
 * The module cache is cleared because configuration intentionally reads env once.
 */
const configPath = require.resolve('../../src/config');
function loadConfig(environment) {
  const currentEnv = process.env;
  process.env = environment;
  jest.resetModules();
  delete require.cache[configPath];
  try {
    return require('../../src/config');
  } finally {
    process.env = currentEnv;
  }
}
afterEach(() => { jest.resetModules(); delete require.cache[configPath]; });
test('missing DATABASE_URL names the setting', () => {
  const environment = {};
  expect(() => loadConfig(environment)).toThrow('DATABASE_URL');
});
test('applies documented defaults', () => {
  const config = loadConfig({ DATABASE_URL: 'postgres://ix:ix@localhost:5432/ix', PORT: undefined, HOST: undefined, NODE_ENV: undefined, LOG_LEVEL: undefined, PUBLIC_BASE_URL: undefined, SIMULATION_MODE: undefined });
  expect(config).toMatchObject({ NODE_ENV: 'development', PORT: 8000, HOST: '0.0.0.0', LOG_LEVEL: 'info', PUBLIC_BASE_URL: 'http://localhost:8000', SIMULATION_MODE: true, DB_AUTO_MIGRATE: true, API_TOKEN: '', TEST_DATABASE_URL: '', IDEMPOTENCY_TTL_HOURS: 24, IDEMPOTENCY_WAIT_MS: 5000, IDEMPOTENCY_LOCK_TTL_SECONDS: 60, CONNECTOR_HTTP_TIMEOUT_MS: 10000, CONNECTOR_MAX_BACKOFF_MS: 5000, CIRCUIT_FAILURE_THRESHOLD: 5, CIRCUIT_COOLDOWN_SECONDS: 60, CONNECTORS_DISABLED: [] });
});
test('parses SIMULATION_MODE as a boolean', () => {
  expect(loadConfig({ DATABASE_URL: 'postgres://ix:ix@localhost:5432/ix', SIMULATION_MODE: 'false' }).SIMULATION_MODE).toBe(false);
});
test('parses DB_AUTO_MIGRATE as a boolean', () => {
  expect(loadConfig({ DATABASE_URL: 'postgres://ix:ix@localhost:5432/ix', DB_AUTO_MIGRATE: 'false' }).DB_AUTO_MIGRATE).toBe(false);
});
test('invalid boolean settings name the setting', () => {
  expect(() => loadConfig({ DATABASE_URL: 'postgres://ix:ix@localhost:5432/ix', DB_AUTO_MIGRATE: 'yes' })).toThrow('DB_AUTO_MIGRATE');
});
test('reads API_TOKEN and TEST_DATABASE_URL from the supplied environment', () => {
  const config = loadConfig({ DATABASE_URL: 'postgres://ix:ix@localhost:5432/ix', API_TOKEN: 'test-token', TEST_DATABASE_URL: 'postgres://ix:ix@localhost:5432/ix_test' });
  expect(config.API_TOKEN).toBe('test-token');
  expect(config.TEST_DATABASE_URL).toBe('postgres://ix:ix@localhost:5432/ix_test');
});
test('parses idempotency numeric settings and rejects invalid values', () => {
  const base = { DATABASE_URL: 'postgres://ix:ix@localhost:5432/ix' };
  expect(loadConfig({ ...base, IDEMPOTENCY_TTL_HOURS: '48', IDEMPOTENCY_WAIT_MS: '0', IDEMPOTENCY_LOCK_TTL_SECONDS: '90' })).toMatchObject({ IDEMPOTENCY_TTL_HOURS: 48, IDEMPOTENCY_WAIT_MS: 0, IDEMPOTENCY_LOCK_TTL_SECONDS: 90 });
  for (const [name, value] of [['IDEMPOTENCY_TTL_HOURS', '0'], ['IDEMPOTENCY_TTL_HOURS', '1.5'], ['IDEMPOTENCY_WAIT_MS', '-1'], ['IDEMPOTENCY_WAIT_MS', 'abc'], ['IDEMPOTENCY_LOCK_TTL_SECONDS', '0']]) {
    expect(() => loadConfig({ ...base, [name]: value })).toThrow(name);
  }
});
test('parses connector settings and rejects invalid integers', () => {
  const base = { DATABASE_URL: 'postgres://ix:ix@localhost:5432/ix' };
  expect(loadConfig({ ...base, CONNECTORS_DISABLED: 'discourse, lemmy' })).toMatchObject({ CONNECTORS_DISABLED: ['discourse', 'lemmy'] });
  for (const [name, value] of [['CONNECTOR_HTTP_TIMEOUT_MS', '0'], ['CONNECTOR_MAX_BACKOFF_MS', '-1'], ['CIRCUIT_FAILURE_THRESHOLD', '1.5'], ['CIRCUIT_COOLDOWN_SECONDS', '0']]) {
    expect(() => loadConfig({ ...base, [name]: value })).toThrow(name);
  }
});
