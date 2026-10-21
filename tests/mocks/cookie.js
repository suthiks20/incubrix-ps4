// The cookie package in the Docker install is ESM-only, while Jest runs CommonJS.
// light-my-request, used by Fastify's inject(), imports this package.
// This test-only shim stands in for that dependency during Jest runs.
// Application code must never use this file.
function parseCookie(header) {
  const cookies = {};
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (!name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

function stringifySetCookie(cookie) {
  return `${cookie.name}=${cookie.value}`;
}

module.exports = { parseCookie, stringifySetCookie };
