/**
 * Builds the short-lived Ghost Admin API token from an id:hex-secret connection.
 * The token is generated per request and the connection value is never retained.
 */
import crypto from 'crypto';
import AppError = require('../../../shared/errors/AppError');

function ghostJwt(key: string, now = Date.now): string {
  const [id, secret] = String(key || '').split(':');
  if (!id || !secret || !/^[a-f0-9]+$/i.test(secret)) {
    throw new AppError('CONNECTION_AUTH_EXPIRED', 'Ghost Admin API key is invalid', { statusCode: 401 });
  }
  const iat = Math.floor(now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iat, exp: iat + 300, aud: '/admin/' })).toString('base64url');
  const signature = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(`${header}.${payload}`);
  return `${header}.${payload}.${signature.digest('base64url')}`;
}

export { ghostJwt };
