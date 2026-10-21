/**
 * Covers pure host, sandbox, connector, and configuration certification checks.
 * Errors are AppErrors so callers retain the standard response envelope.
 */
const { assertCanCertify } = require('../../src/modules/certification/services/preconditions');
const config = { CERT_ALLOWED_HOSTS: ['localhost'] }; const connector = { tier: 'native' }; const destination = { connector_key: 'discourse', config: { base_url: 'http://localhost/x' } };
test('allows listed host and sandbox', () => { expect(() => assertCanCertify({ destination, connector, config, disabledConnectors: [] })).not.toThrow(); expect(() => assertCanCertify({ destination: { ...destination, config: { base_url: 'https://x.test', sandbox: true } }, connector, config, disabledConnectors: [] })).not.toThrow(); });
test.each([[null, connector, 'NOT_FOUND'], [destination, null, 'CONNECTOR_DISABLED'], [{ ...destination, config: {} }, connector, 'CERT_CONFIG_INVALID'], [{ ...destination, config: { base_url: 'https://x.test' } }, connector, 'CERT_HOST_NOT_ALLOWED']])('rejects invalid precondition', (item, entry, code) => expect(() => assertCanCertify({ destination: item, connector: entry, config, disabledConnectors: [] })).toThrow(expect.objectContaining({ code })));
