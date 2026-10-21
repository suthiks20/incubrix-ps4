/**
 * Validates certification safety conditions before a run row or platform request exists.
 * The checks use only supplied values and make no database or network calls.
 */
const AppError = require('../../../shared/errors/AppError');
function assertCanCertify({ destination, connector, config, disabledConnectors }) {
  if (!destination) throw new AppError('NOT_FOUND', 'Destination not found', { statusCode: 404 });
  if (!connector || disabledConnectors.includes(destination.connector_key)) {
    throw new AppError('CONNECTOR_DISABLED', 'Connector is disabled', { statusCode: 409 });
  }
  const baseUrl = destination.config && destination.config.base_url;
  if (!baseUrl && connector.tier !== 'assisted') {
    throw new AppError('CERT_CONFIG_INVALID', 'Certification requires destination config.base_url', { statusCode: 409 });
  }
  if (!baseUrl || destination.config.sandbox === true) return;
  if (!config.CERT_ALLOWED_HOSTS.includes(new URL(baseUrl).hostname)) {
    throw new AppError('CERT_HOST_NOT_ALLOWED', 'Certification host is not allowed', { statusCode: 409 });
  }
}
module.exports = { assertCanCertify };
