/**
 * This is the deliberately small lint policy for JavaScript and TypeScript source.
 * It catches accidental globals while leaving the code easy to explain.
 */
const tseslint = require('typescript-eslint');

const rules = {
  'no-undef': 'error',
  'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  'no-console': 'error',
  semi: ['error', 'always'],
  quotes: ['error', 'single', { avoidEscape: true }]
};

const globals = {
  process: 'readonly',
  URL: 'readonly',
  crypto: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  fetch: 'readonly',
  AbortController: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  URLSearchParams: 'readonly',
  Headers: 'readonly'
};

module.exports = [
  {
    files: ['**/*.js'],
    ignores: ['node_modules/**', 'coverage/**', 'dist/**'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals },
    rules
  },
  {
    files: ['**/*.ts'],
    ignores: ['node_modules/**', 'coverage/**', 'dist/**'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals, parser: tseslint.parser },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      ...rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['tests/**/*.js', '**/__mocks__/**/*.js'],
    languageOptions: { globals: { jest: 'readonly', test: 'readonly', expect: 'readonly', beforeAll: 'readonly', beforeEach: 'readonly', afterAll: 'readonly', afterEach: 'readonly', process: 'readonly' } }
  }
];
