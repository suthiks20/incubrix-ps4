/**
 * Dispatches connector contract calls and applies service-level access checks.
 * Platform-specific HTTP and ledger work stays in connector and ledger modules.
 */
const AppError = require('../../../shared/errors/AppError');
const registry = require('../registry');
const ledger = require('../../ledger/service');
const destinations = require('../../destinations/repository/destinations');
const { assertValidKey } = require('../../../shared/idempotency/keyValidation');
const instances = new WeakMap();

function connectorFor(app, entry) {
  if (!instances.has(app)) instances.set(app, new Map());
  const cache = instances.get(app);
  if (!cache.has(entry.manifest.key)) cache.set(entry.manifest.key, entry.createDiscourse({ config: app.config, logger: app.log }));
  return cache.get(entry.manifest.key);
}

async function execute(app, key, method, input) {
  const entry = registry.get(key);
  if (!entry) throw new AppError('NOT_FOUND', 'Connector not found', { statusCode: 404 });
  if (app.config.CONNECTORS_DISABLED.includes(key)) throw new AppError('CONNECTOR_DISABLED', 'Connector is disabled', { statusCode: 409 });
  const connector = connectorFor(app, entry);
  assertValidKey(input.idempotency_key);
  const destination = input.destination || (input.destination_id ? await destinations.findById(app.knex, input.destination_id) : null);
  if (input.destination_id && !destination) throw new AppError('NOT_FOUND', 'Destination not found', { statusCode: 404 });
  if (destination && destination.enabled === false) throw new AppError('DESTINATION_DISABLED', 'Destination is disabled', { statusCode: 409 });
  const resolvedDestination = destination || { config: { base_url: input.destination_ref || input.base_url }, category: input.category };
  const connection = input.connection || {};
  const rendition = input.rendition || {};
  if (method === 'validate') return { violations: connector.validate(rendition) };
  if (method === 'publish') {
    const violations = connector.validate(rendition);
    if (violations.length) throw new AppError('DEST_SPEC_VIOLATION', 'Content does not meet destination requirements', { statusCode: 400, details: { violations } });
    return ledger.publish(app.knex, connector, rendition, resolvedDestination, connection, input.idempotency_key);
  }
  if (method === 'get_status') return connector.get_status(resolvedDestination, connection, input.platform_post_id);
  if (method === 'delete') return connector.delete(resolvedDestination, connection, input.platform_post_id);
  if (['fetch_metrics', 'refresh_auth', 'build_assist_pack'].includes(method)) return entry.unsupported();
  throw new AppError('CONNECTOR_NOT_IMPLEMENTED', 'Connector method is not implemented', { statusCode: 501 });
}
module.exports = { execute };
