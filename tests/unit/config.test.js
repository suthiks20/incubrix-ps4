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
  expect(config).toMatchObject({ NODE_ENV: 'development', PORT: 8000, HOST: '0.0.0.0', LOG_LEVEL: 'info', PUBLIC_BASE_URL: 'http://localhost:8000', SIMULATION_MODE: true });
});
test('parses SIMULATION_MODE as a boolean', () => {
  expect(loadConfig({ DATABASE_URL: 'postgres://ix:ix@localhost:5432/ix', SIMULATION_MODE: 'false' }).SIMULATION_MODE).toBe(false);
});
