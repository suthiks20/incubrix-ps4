/**
 * Jest discovers the small unit and app-injection integration suites.
 * Tests choose their own environment so this file has no runtime side effects.
 */
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup/silenceLogs.js'],
  roots: ['<rootDir>/tests'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  globalSetup: '<rootDir>/tests/setup/globalSetup.js',
  clearMocks: true,
  transformIgnorePatterns: ['/node_modules/(?!(cookie)/)'],
  moduleNameMapper: { '^cookie$': '<rootDir>/tests/mocks/cookie.js' }
};
