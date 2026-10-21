/**
 * Checks the Pino options censor credentials in a memory-backed log stream.
 * No files or network access are needed for this logging unit test.
 */
process.env.DATABASE_URL = 'postgres://ix:ix@localhost:5432/ix';
const pino = require('pino');
const { Writable } = require('stream');
const loggerOptions = require('../../src/shared/logger');
test('redacts secrets and authorization headers', () => {
  let output = '';
  const stream = new Writable({ write(chunk, _encoding, callback) { output += chunk; callback(); } });
  pino({ ...loggerOptions, level: 'info' }, stream).info({ token: 'abc123SECRET', req: { headers: { authorization: 'Bearer private-value' } } }, 'test');
  expect(output).not.toContain('abc123SECRET');
  expect(output).not.toContain('Bearer private-value');
  expect(output).toContain('[REDACTED]');
});
