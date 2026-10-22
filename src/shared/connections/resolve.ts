/**
 * Resolves named connection JSON from environment without ever logging values.
 * Simulation uses explicit fake credentials only for the local mock platforms.
 */
import AppError = require('../errors/AppError');

function resolveConnection(destination: any, config: any): Record<string, any> {
  const name = String(destination.connection_ref || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const envName = `CONNECTION_${name}`;
  if (name && process.env[envName]) {
    try {
      return JSON.parse(process.env[envName] as string);
    } catch {
      throw new AppError('CONNECTION_AUTH_EXPIRED', 'Connection setting is not valid JSON', {
        statusCode: 401,
        details: { action: 'Set CONNECTION_<CONNECTION_REF> to valid JSON.' }
      });
    }
  }
  if (config.SIMULATION_MODE) {
    if (destination.connector_key === 'discourse') return { api_key: 'sim-key', api_username: 'sim-user' };
    if (destination.connector_key === 'webhook') return { signing_secret: 'test-signing-secret' };
    if (destination.connector_key === 'devto') return { api_key: 'sim-key' };
    if (destination.connector_key === 'lemmy') return { username: 'sim-user', password: 'sim-pass' };
    if (destination.connector_key === 'ghost') {
      return { admin_api_key: 'sim-id:00112233445566778899aabbccddeeff' };
    }
    if (destination.connector_key === 'slack') return { bot_token: 'sim-token' };
    if (destination.connector_key === 'hashnode') return { token: 'sim-token' };
    return {};
  }
  throw new AppError('CONNECTION_AUTH_EXPIRED', 'No connection is configured for this destination', {
    statusCode: 401,
    details: { action: 'Set CONNECTION_<CONNECTION_REF> to a JSON connection object.' }
  });
}

export { resolveConnection };
