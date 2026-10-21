/**
 * Verifies request hashes are stable for object key ordering and sensitive to content.
 * Hashing is pure and does not need a database connection.
 */
const { requestHash } = require('../../src/shared/idempotency/hash');

test('object key order does not change a request hash', () => {
  expect(requestHash('POST', '/x', '', { a: 1, b: { c: 2, d: 3 } })).toBe(requestHash('POST', '/x', '', { b: { d: 3, c: 2 }, a: 1 }));
});
test('different body values produce different hashes', () => {
  expect(requestHash('POST', '/x', '', { a: 1 })).not.toBe(requestHash('POST', '/x', '', { a: 2 }));
});
test('different query strings produce different hashes', () => {
  expect(requestHash('POST', '/x', 'a=1', {})).not.toBe(requestHash('POST', '/x', 'a=2', {}));
});
