/**
 * Builds safe certification evidence without retaining connection credentials.
 * Recursive redaction protects nested platform payloads from accidental leakage.
 */
const SECRET_KEYS = new Set(['api_key', 'api_username', 'signing_secret', 'token', 'secret', 'password', 'connection']);
function safe(value) { if (Array.isArray(value)) return value.map(safe); if (!value || typeof value !== 'object') return value; return Object.fromEntries(Object.entries(value).filter(([key]) => !SECRET_KEYS.has(key)).map(([key, entry]) => [key, safe(entry)])); }
function buildEvidence(run, destination, connector, steps) { return safe({ ...run, destination: { name: destination.name, url: destination.url, connector_key: destination.connector_key, platform_key: destination.platform_key }, connector: { key: connector.key, version: connector.version }, steps }); }
module.exports = { buildEvidence };
