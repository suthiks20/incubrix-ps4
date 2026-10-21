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
const { evaluate } = require('../../rules/engine');

function connectorFor(app, entry) {
  if (!instances.has(app)) instances.set(app, new Map());
  const cache = instances.get(app);
  if (!cache.has(entry.manifest.key)) cache.set(entry.manifest.key, entry.createConnector({ config: app.config, logger: app.log }));
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
  const resolvedDestination = destination || { config: { base_url: input.destination_ref || input.base_url }, category: input.category };
  const connection = input.connection || {};
  const rendition = input.rendition || {};
  if (method === 'validate') return { violations: connector.validate(rendition) };
  if (method === 'publish') {
    const violations = connector.validate(rendition);
    if (violations.length) throw new AppError('DEST_SPEC_VIOLATION', 'Content does not meet destination requirements', { statusCode: 400, details: { violations } });
    const windowDays = resolvedDestination.frequency_cap && resolvedDestination.frequency_cap.per_days || 36500;
    const since = new Date(Date.now() - Number(windowDays) * 86400000).toISOString();
    const destinationRef = String(resolvedDestination.config.base_url || '').replace(/\/$/, '').toLowerCase();
    const history = { published_at: await ledger.publishedTimes(app.knex, connector.key, destinationRef, since) };
    const rules = evaluate({ rendition, destination: resolvedDestination, history, now: new Date().toISOString() });
    if (rules.decision === 'reschedule') throw new AppError('DEST_RULE_FREQUENCY_CAP', 'Destination frequency cap requires rescheduling', { statusCode: 429, retryable: true, details: { next_allowed_at: rules.next_allowed_at, reasons: rules.reasons } });
    if (rules.decision === 'block' || rules.decision === 'assist') {
      const stateCode = rules.reasons.find((reason) => ['DESTINATION_DISABLED', 'DESTINATION_DEMOTED'].includes(reason.code));
      const code = stateCode ? stateCode.code : 'DEST_RULE_VIOLATION';
      const statusCode = stateCode ? (stateCode.code === 'DESTINATION_DISABLED' ? 409 : 409) : rules.decision === 'assist' ? 409 : 422;
      throw new AppError(code, 'Destination rules do not allow automated publishing', { statusCode, details: { reasons: rules.reasons } });
    }
    const result = await ledger.publish(app.knex, connector, rules.rendition, resolvedDestination, connection, input.idempotency_key);
    return { ...result, warnings: rules.reasons.filter((reason) => reason.severity === 'fixed' || reason.severity === 'warn') };
  }
  if (method === 'get_status') return connector.get_status(resolvedDestination, connection, input.platform_post_id);
  if (method === 'delete') return connector.delete(resolvedDestination, connection, input.platform_post_id);
  if (method === 'build_assist_pack') {
    if (key !== 'assisted') throw new AppError('CONNECTOR_NOT_IMPLEMENTED', 'build_assist_pack is available only on the assisted connector', { statusCode: 501 });
    return connector.build_assist_pack(rendition, resolvedDestination);
  }
  if (['fetch_metrics', 'refresh_auth'].includes(method)) return entry.unsupported();
  throw new AppError('CONNECTOR_NOT_IMPLEMENTED', 'Connector method is not implemented', { statusCode: 501 });
}
module.exports = { execute };
