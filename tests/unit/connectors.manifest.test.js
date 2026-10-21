/**
 * Checks that connector manifests require their documented keys and mappings.
 * Loader tests do not touch the filesystem or platform network.
 */
const { validateManifest } = require('../../src/modules/connectors/manifestLoader');
const { manifest } = require('../../src/modules/connectors/discourse');
test('accepts the Discourse manifest', () => { expect(validateManifest(manifest)).toBe(manifest); });
test('rejects missing manifest keys and unknown error mappings', () => {
  expect(() => validateManifest({ key: 'missing' })).toThrow('missing required keys');
  expect(() => validateManifest({ ...manifest, error_map: { 418: 'UNKNOWN_CODE' } })).toThrow('unknown error code');
});
