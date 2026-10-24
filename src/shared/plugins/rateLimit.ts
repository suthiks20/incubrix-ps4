/**
 * Enforces a simple in-memory request cap per IP for public HTTP endpoints.
 * Health checks remain public so orchestration can monitor the service.
 */
import AppError = require('../errors/AppError');

function rateLimit(app: any, config: any): void {
  const limit = Number(config?.RATE_LIMIT_PER_MINUTE || 60);
  const buckets = new Map<string, number[]>();

  app.addHook('onRequest', async (request: any, reply: any) => {
    const path = String(request.raw.url.split('?')[0]);
    if (path === '/' || path === '/openapi.yaml' || path.startsWith('/mock/') ||
      path === '/health' || path === '/ready' ||
      path === '/api/v1/health' || path === '/api/v1/ready') {
      return;
    }

    const now = Date.now();
    const windowMs = 60_000;
    const ip = request.ip || request.headers['x-forwarded-for'] || 'anonymous';
    const samples = (buckets.get(ip) || []).filter((timestamp) => now - timestamp < windowMs);

    if (samples.length >= limit) {
      reply.header('Retry-After', '60');
      throw new AppError('RATE_LIMITED', 'Too many requests for this endpoint', {
        statusCode: 429,
        retryable: true,
        details: { limit_per_minute: limit, retry_after_seconds: 60 }
      });
    }

    samples.push(now);
    buckets.set(ip, samples);
  });
}

export = rateLimit;
