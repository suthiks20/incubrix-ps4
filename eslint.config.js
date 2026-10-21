/**
 * This is the deliberately small lint policy for plain CommonJS source.
 * It catches accidental globals while leaving the code easy to explain.
 */
module.exports = [
  {
    files: ['**/*.js'],
    ignores: ['node_modules/**', 'coverage/**'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { process: 'readonly', URL: 'readonly', crypto: 'readonly', Buffer: 'readonly', __dirname: 'readonly' } },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'error',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }]
    }
  }
  ,
  {
    files: ['tests/**/*.js', '**/__mocks__/**/*.js'],
    languageOptions: { globals: { jest: 'readonly', test: 'readonly', expect: 'readonly', beforeAll: 'readonly', beforeEach: 'readonly', afterAll: 'readonly', afterEach: 'readonly', process: 'readonly' } }
  }
];
