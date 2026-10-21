/**
 * Tests URL canonicalization rules used for destination identity checks.
 * Invalid or non-HTTP URLs must become validation application errors.
 */
const normalizeUrl = require('../../src/modules/destinations/commons/normalizeUrl');
test('removes a non-root trailing slash', () => expect(normalizeUrl('https://forum.example.com/topics/')).toBe('https://forum.example.com/topics'));
test('lowercases scheme and host while preserving path case and query', () => expect(normalizeUrl('HTTPS://FORUM.EXAMPLE.COM/Topic?Tag=One')).toBe('https://forum.example.com/Topic?Tag=One'));
test('removes fragments and default ports', () => expect(normalizeUrl('http://FORUM.EXAMPLE.COM:80/path/#intro')).toBe('http://forum.example.com/path'));
test('rejects invalid and non-HTTP URLs', () => {
  expect(() => normalizeUrl('not a URL')).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  expect(() => normalizeUrl('ftp://forum.example.com')).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
});
