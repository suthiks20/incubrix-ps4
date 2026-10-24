/**
 * Resolves named connection JSON from environment without ever logging values.
 * Simulation uses explicit fake credentials only for the local mock platforms.
 */
import AppError = require('../errors/AppError');
const fs = require('fs');

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

function readConnectionsFile(config: any): Record<string, any> {
  const filePath = config.CONNECTIONS_FILE || '/app/data/connections.json';
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid connection file shape');
    }
    return parsed;
  } catch (error: any) {
    if (error.code === 'ENOENT') return {};
    throw new AppError('CONNECTION_AUTH_EXPIRED', 'Connection file could not be read', {
      statusCode: 401
    });
  }
}

function fileConnection(
  connectionRef: string,
  connectorKey: string,
  config: any
): Record<string, any> {
  const file = readConnectionsFile(config);
  const normalized = String(connectionRef || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const bare = normalized.replace(/_local$/, '');
  const names = [normalized, bare, connectorKey, `${connectorKey}_local`];
  for (const name of names) {
    const value = file[name];
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  }
  return {};
}

function resolveConnection(destination: any, config: any): Record<string, any> {
  const name = String(destination.connection_ref || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const envName = `CONNECTION_${name}`;
  const environmentValue = process.env[envName];
  const stored = fileConnection(destination.connection_ref || '', destination.connector_key, config);
  if (name && environmentValue !== undefined && environmentValue !== '') {
    try {
      const connection = JSON.parse(environmentValue);
      if (!connection || typeof connection !== 'object' || Array.isArray(connection)) {
        throw new Error('invalid connection value');
      }
      const merged = { ...stored, ...connection };
      if (destination.connector_key === 'ghost') return normaliseGhostConnection(merged);
      return merged;
    } catch {
      throw new AppError('CONNECTION_AUTH_EXPIRED', 'Connection setting is not valid JSON', {
        statusCode: 401,
        details: { action: 'Set CONNECTION_<CONNECTION_REF> to valid JSON.' }
      });
    }
  }

  if (Object.keys(stored).length > 0) {
    return destination.connector_key === 'ghost' ? normaliseGhostConnection({ ...stored }) : stored;
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
