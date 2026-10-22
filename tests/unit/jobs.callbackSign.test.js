/**
 * Locks the callback HMAC format to a fixed public test vector.
 * The vector covers the timestamp separator as well as the SHA-256 digest.
 */
const { sign } = require('../../src/modules/jobs/callbackSign');

test('callback signature known vector', () => {
  const actual = sign('test-secret', '1700000000', '{"job_id":"one"}');
  // openssl dgst -sha256 -hmac 'test-secret' for 1700000000.{"job_id":"one"}
  expect(actual).toBe('sha256=2b63a665cfcc1915ee2c345a3706a2eb6d22709cb4eb0c5cface9d8bb7933100');
});
