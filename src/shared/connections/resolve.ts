/**
 * Resolves named connection JSON from environment without ever logging values.
 * Simulation uses explicit fake credentials only for the local mock platforms.
 */
import AppError = require('../errors/AppError');
const fs = require('fs');
const path = require('path');

function normaliseGhostConnection(connection: Record<string, any>): Record<string, any> {
  if (!connection || typeof connection !== 'object') return {};
  if (!connection.api_key && connection.admin_api_key) {
    connection.api_key = connection.admin_api_key;
  }
  if (!connection.admin_api_key && connection.api_key) {
    connection.admin_api_key = connection.api_key;
  }
  return connection;
}

function readBootstrapFile(): Record<string, any> {
  const candidates = [
    process.env.BOOTSTRAP_OUTPUT_PATH,
    path.resolve(process.cwd(), 'bootstrap-output.json'),
    path.resolve(__dirname, '../../../bootstrap-output.json'),
    path.resolve(__dirname, '../../bootstrap-output.json')
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Ignore bootstrap file read errors; env and simulation mode remain authoritative.
    }
  }
  return {};
}

function bootstrapConnection(connectionRef: string, connectorKey: string): Record<string, any> | undefined {
  const file = readBootstrapFile();
  const bare = String(connectionRef || '').toLowerCase().replace(/_local$/, '').replace(/[^a-z0-9]/g, '');
  const key = bare || connectorKey;
  const direct = file[key] || file[`${key}_local`] || file[`${connectorKey}`];
  if (!direct || typeof direct !== 'object') return undefined;
  if (connectorKey === 'ghost') return normaliseGhostConnection(direct);
  return direct;
}

function resolveConnection(destination: any, config: any): Record<string, any> {
  const name = String(destination.connection_ref || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const envName = `CONNECTION_${name}`;
  if (name && process.env[envName]) {
    try {
      const connection = JSON.parse(process.env[envName] as string);
      if (destination.connector_key === 'ghost') return normaliseGhostConnection(connection);
      return connection;
    } catch {
      throw new AppError('CONNECTION_AUTH_EXPIRED', 'Connection setting is not valid JSON', {
        statusCode: 401,
        details: { action: 'Set CONNECTION_<CONNECTION_REF> to valid JSON.' }
      });
    }
  }

  const bootstrap = bootstrapConnection(destination.connection_ref || '', destination.connector_key);
  if (bootstrap) {
    return destination.connector_key === 'ghost' ? normaliseGhostConnection(bootstrap) : bootstrap;
  }
  if (config.SIMULATION_MODE) {
    if (destination.connector_key === 'discourse') return { api_key: 'sim-key', api_username: 'sim-user' };
    if (destination.connector_key === 'webhook') return { signing_secret: 'test-signing-secret' };
    if (destination.connector_key === 'devto') return { api_key: 'sim-key' };
    if (destination.connector_key === 'lemmy') return { username: 'sim-user', password: 'sim-pass' };
    if (destination.connector_key === 'ghost') {
      return normaliseGhostConnection({ api_key: 'sim-id:00112233445566778899aabbccddeeff' });
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
