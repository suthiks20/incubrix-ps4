/**
 * Protects versioned API routes with an optional bearer token.
 * Public health paths remain available for orchestration and diagnostics.
 */
import crypto from 'crypto';
import AppError = require('../errors/AppError');

async function auth(app: any, options: { apiToken?: string }): Promise<void> {
  const expectedToken = options.apiToken || '';
  app.addHook('onRequest', async (request) => {
    if (!expectedToken) return;
    const path = request.raw.url.split('?')[0];
    const protectedPath = path.startsWith('/api/v1') || path.startsWith('/connector/v1');
    if (!protectedPath || path === '/api/v1/health' || path === '/api/v1/ready') return;

    const authorization = request.headers.authorization || '';
    const suppliedToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const expected = Buffer.from(expectedToken);
    const supplied = Buffer.from(suppliedToken);
    const isValid = expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
    if (!isValid) throw new AppError('UNAUTHORIZED', 'Missing or invalid bearer token', { statusCode: 401 });
  });
}

export = auth;
