/**
 * Fetches bounded rule-page text only from public HTTP(S) hosts.
 * Redirect targets are checked again before any request is sent.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import AppError = require('../shared/errors/AppError');
import { publicHttpUrl } from '../modules/catalogue/service';

const MAX_PAGE_BYTES = 100000;
const MAX_REDIRECTS = 3;

function unsafeUrlError(): AppError {
  return new AppError('VALIDATION_ERROR', 'Rules URL must use a public HTTP or HTTPS address', {
    statusCode: 400
  });
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const octets = address.split('.').map(Number);
    return octets[0] === 0 || octets[0] === 10 || octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) || octets[0] >= 224;
  }
  const normalized = address.toLowerCase();
  return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') ||
    normalized.startsWith('fd') || /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('::ffff:');
}

async function assertPublicUrl(value: string): Promise<URL> {
  let url: URL;
  try {
    url = publicHttpUrl(value);
  } catch {
    throw unsafeUrlError();
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) throw unsafeUrlError();
  const addresses = await lookup(host, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw unsafeUrlError();
  }
  return url;
}

async function readBounded(response: Response): Promise<string> {
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_PAGE_BYTES || !response.body) throw providerPageError();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > MAX_PAGE_BYTES) {
      await reader.cancel();
      throw providerPageError();
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function providerPageError(): AppError {
  return new AppError('LLM_PROVIDER_ERROR', 'Rules page request failed', {
    statusCode: 502,
    retryable: true
  });
}

async function fetchRulesPage(value: string, options: any = {}): Promise<string> {
  const fetcher = options.fetcher || globalThis.fetch;
  const timeout = options.timeoutMs || 10000;
  let url = await assertPublicUrl(value);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    let response: Response;
    try {
      response = await fetcher(url.toString(), {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeout)
      });
    } catch {
      throw providerPageError();
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirects === MAX_REDIRECTS) throw providerPageError();
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw providerPageError();
    return readBounded(response);
  }
  throw providerPageError();
}

export { fetchRulesPage, assertPublicUrl };
