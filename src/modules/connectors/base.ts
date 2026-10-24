/**
 * Provides manifest validation, safe HTTP calls, retries, and circuit breaking.
 * Platform connectors supply only their endpoint-specific request and response logic.
 */
import AppError = require('../../shared/errors/AppError');
import config = require('../../config');
import codes = require('../../shared/errors/codes');
import type { Connection, Destination, ErrorCode, Manifest, Rendition, Violation } from './types';

function requireFields(value: any, fields: any[]): any {
  const missing = fields.filter((entry) => {
    const field = typeof entry === 'string' ? entry : entry.name;
    const expected = typeof entry === 'string' ? null : entry.type;
    const actual = value && value[field];
    if (expected) return typeof actual !== expected && !(expected === 'number' && Number.isInteger(actual));
    return typeof actual !== 'string' && typeof actual !== 'number' && !Array.isArray(actual);
  }).map((entry) => typeof entry === 'string' ? entry : entry.name);
  if (missing.length) throw new AppError('SCHEMA_DRIFT', 'Platform response is missing required fields', { statusCode: 502, details: { missing_fields: missing } });
  return value;
}

function createBase(manifest: Manifest, options: any = {}): any {
  const circuits = new Map();
  const now = options.now || Date.now;
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const fetchImpl = options.fetch || fetch;
  const runtimeConfig = options.config || config;
  function validate(rendition: Rendition, surfaceKey?: string, destination?: Destination): Violation[] {
    const surfaces = Array.isArray(manifest.surfaces) ? manifest.surfaces :
      Object.entries(manifest.surfaces).map(([key, value]) => ({ key, ...(value as any) }));
    const surface = surfaces.find((entry) => entry.key === surfaceKey) || surfaces[0];
    const spec = surface.spec;
    const violations = [];
    if (typeof rendition.title !== 'string') violations.push({ field: 'title', code: 'required', message: 'Title is required' });
    else if (rendition.title.length > spec.title_max_chars) violations.push({ field: 'title', code: 'max_length', message: `Title must be at most ${spec.title_max_chars} characters` });
    if (typeof rendition.body !== 'string') violations.push({ field: 'body', code: 'required', message: 'Body is required' });
    else if (rendition.body.length > spec.body_max_chars) violations.push({ field: 'body', code: 'max_length', message: `Body must be at most ${spec.body_max_chars} characters` });
    if (rendition.links !== undefined && (!Array.isArray(rendition.links) || rendition.links.some((link) => typeof link !== 'string'))) {
      violations.push({ field: 'links', code: 'invalid', message: 'Links must be an array of strings' });
    } else if (!spec.links_allowed && (rendition.links || []).length) {
      violations.push({ field: 'links', code: 'not_allowed', message: 'Links are not allowed' });
    }
    if (manifest.tier !== 'assisted' && Array.isArray(rendition.media)) {
      const allowed = Array.isArray(destination?.config?.media_types)
        ? destination.config.media_types
        : Array.isArray(spec.media_types) ? spec.media_types : [];
      rendition.media.forEach((media, index) => {
        const mediaType = typeof media.type === 'string' ? media.type.toLowerCase() : '';
        const accepted = allowed.some((type: string) => {
          const normalized = String(type).toLowerCase();
          return normalized === '*/*' || normalized === mediaType ||
            (normalized.endsWith('/*') && mediaType.startsWith(normalized.slice(0, -1)));
        });
        if (!accepted) {
          const reason = mediaType
            ? `Media type ${media.type} is not accepted`
            : 'Media type is required';
          violations.push({
            field: `media[${index}].type`,
            code: 'not_allowed',
            message: reason,
            reason,
            allowed
          });
        }
      });
    }
    return violations;
  }
  function platformError(status: number, message: string, headers: Headers): AppError {
    const code: ErrorCode | undefined = options.errorCode?.(status, message) || manifest.error_map[String(status)] ||
      (status === 403 ? 'CONNECTION_AUTH_EXPIRED' : undefined);
    const details: any = { platform_status: status, ...(message ? { platform_message: message } : {}) };
    if (status === 429) {
      const retryHeader = headers.get('retry-after');
      const resetHeader = headers.get('x-ratelimit-reset');
      const retryAfter = retryHeader !== null && Number.isFinite(Number(retryHeader))
        ? Number(retryHeader)
        : resetHeader !== null && Number.isFinite(Number(resetHeader))
          ? Math.max(0, Number(resetHeader) - Math.floor(now() / 1000))
          : undefined;
      details.retry_after_seconds = retryAfter === undefined ? Math.ceil(runtimeConfig.CONNECTOR_MAX_BACKOFF_MS / 1000) : retryAfter;
      details.action = 'Wait for retry_after_seconds before trying again.';
    }
    if (code) return new AppError(code, `Platform returned HTTP ${status}`, {
      statusCode: codes[code].statusCode,
      retryable: codes[code].retryable,
      details
    });
    if (status >= 500) return new AppError('PLATFORM_UNAVAILABLE', 'Platform is temporarily unavailable', { statusCode: 503, retryable: true });
    return new AppError('PLATFORM_CONTENT_REJECTED', 'Platform rejected the request', { statusCode: 422, details });
  }
  async function request(destination: Destination, connection: Connection, url: string, init: any = {}): Promise<any> {
    const baseUrl = destination.config && destination.config.base_url || destination.base_url || destination.url;
    const key = `${manifest.key}:${baseUrl}`;
    const circuit = circuits.get(key) || { failures: 0, openedAt: null };
    if (circuit.openedAt !== null && now() - circuit.openedAt < runtimeConfig.CIRCUIT_COOLDOWN_SECONDS * 1000) {
      throw new AppError('PLATFORM_UNAVAILABLE', 'Connector circuit is open', { statusCode: 503, retryable: true, details: { circuit_open: true } });
    }
    if (circuit.openedAt !== null) { circuit.openedAt = null; circuit.failures = 0; }
    let attempt = 0;
    while (true) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), runtimeConfig.CONNECTOR_HTTP_TIMEOUT_MS);
      let response;
      const authHeaders = options.authHeaders ? options.authHeaders(connection, init) : {};
      try {
        response = await fetchImpl(url, { ...init, signal: controller.signal, headers: { ...(init.headers || {}), ...authHeaders } });
      } catch {
        clearTimeout(timer);
        circuit.failures += 1;
        if (circuit.failures >= runtimeConfig.CIRCUIT_FAILURE_THRESHOLD) circuit.openedAt = now();
        circuits.set(key, circuit);
        throw new AppError('PLATFORM_UNAVAILABLE', 'Request to the platform timed out or the connection dropped', { statusCode: 503, retryable: true });
      }
      clearTimeout(timer);
      if (response.ok) { circuits.set(key, { failures: 0, openedAt: null }); return response; }
      let message = '';
      try { const parsed = await response.clone().json(); message = parsed.errors && parsed.errors.join('; ') || parsed.error || ''; } catch { message = ''; }
      for (const field of options.secretFields || ['api_key', 'api_username']) {
        const secret = connection[field];
        if (typeof secret === 'string' && secret) message = message.split(secret).join('[REDACTED]');
      }
      const hasRetryDelay = response.headers.get('retry-after') !== null || response.headers.get('x-ratelimit-reset') !== null;
      const error = platformError(response.status, message, response.headers);
      if (error.code === 'PLATFORM_UNAVAILABLE') {
        circuit.failures += 1;
        if (circuit.failures >= runtimeConfig.CIRCUIT_FAILURE_THRESHOLD) circuit.openedAt = now();
        circuits.set(key, circuit);
      }
      if (response.status === 429 && hasRetryDelay && attempt === 0 && error.details.retry_after_seconds * 1000 <= runtimeConfig.CONNECTOR_MAX_BACKOFF_MS) {
        if (options.logger) options.logger.info({ retry_after_seconds: error.details.retry_after_seconds }, 'Retrying connector request after rate limit');
        await sleep(error.details.retry_after_seconds * 1000);
        attempt += 1;
        continue;
      }
      throw error;
    }
  }
  async function readJson(response: any): Promise<any> {
    try { return await response.json(); }
    catch { throw new AppError('SCHEMA_DRIFT', 'Platform returned an invalid response', { statusCode: 502, details: { missing_fields: ['<json>'] } }); }
  }
  return { validate, request, requireFields, readJson };
}

export { createBase, requireFields };
