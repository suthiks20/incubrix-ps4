/**
 * Talks to signed partner webhook endpoints without IncuBrix database writes.
 * Ledger recovery is supported by searching each partner for the ix_ref marker.
 */
const crypto = require('crypto');
const AppError = require('../../../shared/errors/AppError');
const { createBase } = require('../base');
const { loadManifest } = require('../manifestLoader');
const { sign } = require('./sign');
const manifest = loadManifest(__dirname + '/manifest.yaml');

function createWebhook(options = {}) {
  const base = createBase(manifest, { ...options, secretFields: ['signing_secret'], authHeaders: (connection, init) => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    return { 'X-IncuBrix-Timestamp': timestamp, 'X-IncuBrix-Signature': sign(connection.signing_secret, timestamp, init.body || '') };
  } });
  const url = (destination, path) => `${destination.config.base_url.replace(/\/$/, '')}${path}`;
  async function publish(rendition, destination, connection, idempotencyKey) {
    const marker = crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16);
    const body = JSON.stringify({ title: rendition.title, body: rendition.body, canonical_url: rendition.canonical_url, language: rendition.language, ix_ref: marker, idempotency_key: idempotencyKey });
    const response = await base.request(destination, connection, url(destination, '/posts'), { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    const result = base.requireFields(await base.readJson(response), [{ name: 'id', type: 'number' }, { name: 'url', type: 'string' }]);
    return { platform_post_id: String(result.id), live_url: result.url, status: 'published' };
  }
  async function get_status(destination, connection, id) {
    try {
      const response = await base.request(destination, connection, url(destination, `/posts/${encodeURIComponent(id)}`));
      const result = base.requireFields(await base.readJson(response), [{ name: 'url', type: 'string' }]);
      return { status: 'published', live_url: result.url };
    } catch (error) { if (error.details && error.details.platform_status === 404) return { status: 'deleted', live_url: null }; throw error; }
  }
  async function remove(destination, connection, id) {
    try { await base.request(destination, connection, url(destination, `/posts/${encodeURIComponent(id)}`), { method: 'DELETE' }); }
    catch (error) { if (!error.details || error.details.platform_status !== 404) throw error; }
    return { deleted: true };
  }
  async function findByMarker(destination, connection, marker) {
    const response = await base.request(destination, connection, `${url(destination, '/posts')}?ix_ref=${encodeURIComponent(marker)}`);
    const result = await base.readJson(response);
    const posts = Array.isArray(result) ? result : result.posts;
    if (!Array.isArray(posts)) throw new AppError('SCHEMA_DRIFT', 'Platform response is missing required fields', { statusCode: 502, details: { missing_fields: ['posts'] } });
    const post = posts[0];
    if (!post) return null;
    base.requireFields(post, [{ name: 'id', type: 'number' }, { name: 'url', type: 'string' }]);
    return { platform_post_id: String(post.id), live_url: post.url, status: 'published' };
  }
  return { key: manifest.key, manifest, validate: base.validate, publish, get_status, delete: remove, findByMarker };
}
const unsupported = async () => { throw new AppError('CONNECTOR_NOT_IMPLEMENTED', 'This connector method is not implemented', { statusCode: 501 }); };
module.exports = { manifest, createWebhook, createConnector: createWebhook, unsupported };
