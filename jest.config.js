/**
 * Jest discovers the small unit and app-injection integration suites.
 * Tests choose their own environment so this file has no runtime side effects.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  clearMocks: true,
  transformIgnorePatterns: ['/node_modules/(?!(cookie)/)']
};
