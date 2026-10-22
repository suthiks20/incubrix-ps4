/**
 * Builds stable hashes for requests regardless of object key order.
 * Stable request hashes let the service distinguish replays from key conflicts.
 */
import crypto from 'crypto';

function sortValue(value: any): any {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((sorted, key) => {
      sorted[key] = sortValue(value[key]);
      return sorted;
    }, Object.create(null));
  }
  return value;
}

function canonicalJson(value: any): string {
  return JSON.stringify(sortValue(value));
}

function requestHash(method: string, path: string, query: string, body: any): string {
  const canonicalBody = body === undefined || body === null || body === '' ? null : body;
  const value = canonicalJson({ method, path, query, body: canonicalBody });
  return crypto.createHash('sha256').update(value).digest('hex');
}

export { canonicalJson, requestHash };
