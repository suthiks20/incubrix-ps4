/**
 * Covers connection resolution precedence and safe failure behavior without logging secrets.
 * Environment values are restored after every test to keep the suite isolated.
 */
const AppError = require('../../src/shared/errors/AppError');
const { resolveConnection } = require('../../src/shared/connections/resolve');

const environmentName = 'CONNECTION_MIXED_REF_2';
const originalValue = process.env[environmentName];

afterEach(() => {
  if (originalValue === undefined) delete process.env[environmentName];
  else process.env[environmentName] = originalValue;
});

test('resolveConnection parses JSON from its named environment value', () => {
  process.env[environmentName] = JSON.stringify({ api_key: 'fake-key', api_username: 'fake-user' });
  const connection = resolveConnection({ connection_ref: 'mixed.ref-2' }, { SIMULATION_MODE: false });
  expect(connection).toEqual({ api_key: 'fake-key', api_username: 'fake-user' });
});

test('resolveConnection maps Ghost admin_api_key to api_key for the connector', () => {
  process.env[environmentName] = JSON.stringify({ admin_api_key: 'ghost-admin-key:abc123' });
  const connection = resolveConnection({ connection_ref: 'mixed.ref-2', connector_key: 'ghost' }, { SIMULATION_MODE: false });
  expect(connection).toEqual({ admin_api_key: 'ghost-admin-key:abc123', api_key: 'ghost-admin-key:abc123' });
});

test('resolveConnection uses simulation credentials when no environment value exists', () => {
  delete process.env[environmentName];
  const connection = resolveConnection(
    { connection_ref: 'mixed.ref-2', connector_key: 'discourse' },
    { SIMULATION_MODE: true }
  );
  expect(connection).toEqual({ api_key: 'sim-key', api_username: 'sim-user' });
});

test('resolveConnection fails safely without an environment value outside simulation', () => {
  delete process.env[environmentName];
  expect(() => resolveConnection({ connection_ref: 'mixed.ref-2' }, { SIMULATION_MODE: false }))
    .toThrow(AppError);
  try {
    resolveConnection({ connection_ref: 'mixed.ref-2' }, { SIMULATION_MODE: false });
  } catch (error) {
    expect(error.code).toBe('CONNECTION_AUTH_EXPIRED');
  }
});

test('resolveConnection normalises connection refs with case and punctuation', () => {
  process.env[environmentName] = JSON.stringify({ signing_secret: 'fake-signing-secret' });
  const connection = resolveConnection({ connection_ref: 'MiXeD.Ref-2' }, { SIMULATION_MODE: false });
  expect(connection).toEqual({ signing_secret: 'fake-signing-secret' });
});

test('malformed connection JSON never leaks its content', () => {
  const secret = 'SUPERSECRET123abc';
  process.env[environmentName] = `{\"api_key\":\"${secret}\"`;
  try {
    resolveConnection({ connection_ref: 'mixed.ref-2' }, { SIMULATION_MODE: false });
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('CONNECTION_AUTH_EXPIRED');
    expect(error.message).toBe('Connection setting is not valid JSON');
    expect(JSON.stringify(error.details)).not.toContain(secret);
    expect(error.message).not.toContain(secret);
    return;
  }
  throw new Error('Expected malformed connection JSON to be rejected');
});
