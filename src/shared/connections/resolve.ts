/**
 * Resolves named connection JSON from environment without ever logging values.
 * Simulation uses explicit fake credentials only for the local mock platforms.
 */
import AppError = require('../errors/AppError');

function resolveConnection(destination: any, config: any): Record<string, any> {
  const name = String(destination.connection_ref || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const envName = `CONNECTION_${name}`;
  if (name && process.env[envName]) return JSON.parse(process.env[envName]);
  if (config.SIMULATION_MODE) {
    if (destination.connector_key === 'discourse') return { api_key: 'sim-key', api_username: 'sim-user' };
    if (destination.connector_key === 'webhook') return { signing_secret: 'test-signing-secret' };
    return {};
  }
  throw new AppError('CONNECTION_AUTH_EXPIRED', 'No connection is configured for this destination', {
    statusCode: 401,
    details: { action: 'Set CONNECTION_<CONNECTION_REF> to a JSON connection object.' }
  });
}

export { resolveConnection };
