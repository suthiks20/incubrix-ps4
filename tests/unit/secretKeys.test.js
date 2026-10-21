/**
 * Tests recursive secret-key detection for destination public configuration.
 * Clean instance settings remain valid and are not treated as credentials.
 */
const assertNoSecretKeys = require('../../src/modules/destinations/commons/secretKeys');
test('finds nested Token and api_key keys', () => {
  expect(() => assertNoSecretKeys({ nested: { Token: 'hidden' }, api_key: 'also hidden' })).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR', details: { fields: expect.any(Array) } }));
});
test('accepts clean configuration objects', () => expect(() => assertNoSecretKeys({ base_url: 'https://forum.example.com', options: { theme: 'blue' } })).not.toThrow());
