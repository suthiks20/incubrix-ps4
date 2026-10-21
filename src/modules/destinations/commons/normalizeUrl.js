/**
 * Canonicalizes destination URLs for duplicate detection.
 * It preserves path casing and query parameters while removing URL noise.
 */
const AppError = require('../../../shared/errors/AppError');

function normalizeUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new AppError('VALIDATION_ERROR', 'URL must be a valid HTTP or HTTPS URL', { statusCode: 400 });
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new AppError('VALIDATION_ERROR', 'URL must be a valid HTTP or HTTPS URL', { statusCode: 400 });
  }
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = '';
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1);
  return url.toString();
}

module.exports = normalizeUrl;
