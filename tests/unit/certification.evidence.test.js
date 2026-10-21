/**
 * Ensures evidence retains safe run data while removing nested credentials.
 * This protects evidence storage from accidental connection leakage.
 */
const { buildEvidence } = require('../../src/modules/certification/services/evidence');
test('strips connection fields at every depth', () => { const result = buildEvidence({ token: 'x', nested: { api_key: 'x', keep: true } }, { name: 'D', url: 'u', connector_key: 'c', platform_key: 'p' }, { key: 'c', version: '1' }, [{ connection: { password: 'x' } }]); expect(JSON.stringify(result)).not.toMatch(/api_key|token|password|connection/); });
