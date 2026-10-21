/**
 * Provides manifest validation, safe HTTP calls, retries, and circuit breaking.
 * Platform connectors supply only their endpoint-specific request and response logic.
 */
const AppError = require('../../shared/errors/AppError');

function requireFields(value, fields) {
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

function createBase(manifest, options = {}) {
  const circuits = new Map();
  const now = options.now || Date.now;
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const fetchImpl = options.fetch || fetch;
  const config = options.config || require('../../config');
  function validate(rendition) {
    const spec = manifest.surfaces.topic.spec;
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
    return violations;
  }
  function platformError(status, message, headers) {
    const code = manifest.error_map[String(status)];
    const details = { platform_status: status, ...(message ? { platform_message: message } : {}) };
    if (status === 429) {
      const retryHeader = headers.get('retry-after');
      const resetHeader = headers.get('x-ratelimit-reset');
      const retryAfter = retryHeader !== null && Number.isFinite(Number(retryHeader))
        ? Number(retryHeader)
        : resetHeader !== null && Number.isFinite(Number(resetHeader))
          ? Math.max(0, Number(resetHeader) - Math.floor(now() / 1000))
          : undefined;
      if (retryAfter !== undefined) details.retry_after_seconds = retryAfter;
    }
    if (code) return new AppError(code, `Platform returned HTTP ${status}`, { statusCode: require('../../shared/errors/codes')[code].statusCode, retryable: require('../../shared/errors/codes')[code].retryable, details });
    if (status >= 500) return new AppError('PLATFORM_UNAVAILABLE', 'Platform is temporarily unavailable', { statusCode: 503, retryable: true });
    return new AppError('PLATFORM_CONTENT_REJECTED', 'Platform rejected the request', { statusCode: 422, details });
  }
  async function request(destination, connection, url, init = {}) {
    const key = `${manifest.key}:${destination.config.base_url}`;
    const circuit = circuits.get(key) || { failures: 0, openedAt: null };
    if (circuit.openedAt !== null && now() - circuit.openedAt < config.CIRCUIT_COOLDOWN_SECONDS * 1000) throw new AppError('PLATFORM_UNAVAILABLE', 'Connector circuit is open', { statusCode: 503, retryable: true });
    if (circuit.openedAt !== null) { circuit.openedAt = null; circuit.failures = 0; }
    let attempt = 0;
    while (true) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.CONNECTOR_HTTP_TIMEOUT_MS);
      let response;
      try {
        response = await fetchImpl(url, { ...init, signal: controller.signal, headers: { ...(init.headers || {}), 'Api-Key': connection.api_key, 'Api-Username': connection.api_username } });
      } catch {
        clearTimeout(timer);
        circuit.failures += 1;
        if (circuit.failures >= config.CIRCUIT_FAILURE_THRESHOLD) circuit.openedAt = now();
        circuits.set(key, circuit);
        throw new AppError('PLATFORM_UNAVAILABLE', 'Platform request failed', { statusCode: 503, retryable: true });
      }
      clearTimeout(timer);
      if (response.ok) { circuits.set(key, { failures: 0, openedAt: null }); return response; }
      let message = '';
      try { const parsed = await response.clone().json(); message = parsed.errors && parsed.errors.join('; ') || parsed.error || ''; } catch { message = ''; }
      for (const secret of [connection.api_key, connection.api_username]) {
        if (typeof secret === 'string' && secret) message = message.split(secret).join('[REDACTED]');
      }
      const error = platformError(response.status, message, response.headers);
      if (error.code === 'PLATFORM_UNAVAILABLE') {
        circuit.failures += 1;
        if (circuit.failures >= config.CIRCUIT_FAILURE_THRESHOLD) circuit.openedAt = now();
        circuits.set(key, circuit);
      }
      if (response.status === 429 && attempt === 0 && error.details.retry_after_seconds !== undefined && error.details.retry_after_seconds * 1000 <= config.CONNECTOR_MAX_BACKOFF_MS) {
        if (options.logger) options.logger.info({ retry_after_seconds: error.details.retry_after_seconds }, 'Retrying connector request after rate limit');
        await sleep(error.details.retry_after_seconds * 1000);
        attempt += 1;
        continue;
      }
      throw error;
    }
  }
  async function readJson(response) {
    try { return await response.json(); }
    catch { throw new AppError('SCHEMA_DRIFT', 'Platform returned an invalid response', { statusCode: 502, details: { missing_fields: ['<json>'] } }); }
  }
  return { validate, request, requireFields, readJson };
}

module.exports = { createBase, requireFields };
