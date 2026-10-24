/**
 * Jest discovers the small unit and app-injection integration suites.
 * Tests choose their own environment so this file has no runtime side effects.
 */
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup/silenceLogs.js'],
  roots: ['<rootDir>/tests'],
  testMatch: ['<rootDir>/tests/**/*.test.[jt]s'],
  globalSetup: '<rootDir>/tests/setup/globalSetup.js',
  maxWorkers: 1,
  testTimeout: 30000,
  clearMocks: true,
  transform: { '^.+\\.[jt]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  transformIgnorePatterns: ['/node_modules/(?!(cookie)/)'],
  moduleNameMapper: { '^cookie$': '<rootDir>/tests/mocks/cookie.js' }
};
