/**
 * Publishes and manages topics through the Discourse REST API.
 * The marker in each post supports safe recovery after ambiguous network failures.
 */
const crypto = require('crypto');
const AppError = require('../../../shared/errors/AppError');
const { createBase } = require('../base');
const { loadManifest } = require('../manifestLoader');
const manifest = loadManifest(__dirname + '/manifest.yaml');

function createDiscourse(options = {}) {
  const base = createBase(manifest, options);
  function apiUrl(destination, path) { return `${destination.config.base_url.replace(/\/$/, '')}${path}`; }
  async function publish(rendition, destination, connection, idempotencyKey) {
    const marker = crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16);
    const raw = `${rendition.body}\n\nix-ref:${marker}`;
    const response = await base.request(destination, connection, apiUrl(destination, '/posts.json'), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: rendition.title, raw, ...(destination.category ? { category: destination.category } : {}) })
    });
    const result = base.requireFields(await base.readJson(response), [{ name: 'id', type: 'number' }, { name: 'topic_id', type: 'number' }, { name: 'topic_slug', type: 'string' }]);
    return { platform_post_id: String(result.topic_id), live_url: `${destination.config.base_url.replace(/\/$/, '')}/t/${result.topic_slug}/${result.topic_id}`, status: 'published', marker };
  }
  async function get_status(destination, connection, id) {
    let response;
    try { response = await base.request(destination, connection, apiUrl(destination, `/t/${encodeURIComponent(id)}.json`)); }
    catch (error) { if (error.code === 'PLATFORM_CONTENT_REJECTED' && error.details.platform_status === 404) return { status: 'deleted', live_url: null }; throw error; }
    const result = base.requireFields(await base.readJson(response), [{ name: 'id', type: 'number' }, { name: 'slug', type: 'string' }]);
    return { status: 'published', live_url: `${destination.config.base_url.replace(/\/$/, '')}/t/${result.slug}/${result.id}` };
  }
  async function remove(destination, connection, id) {
    try { await base.request(destination, connection, apiUrl(destination, `/t/${encodeURIComponent(id)}.json`), { method: 'DELETE' }); }
    catch (error) { if (error.code !== 'PLATFORM_CONTENT_REJECTED' || error.details.platform_status !== 404) throw error; }
    return { deleted: true };
  }
  async function findByMarker(destination, connection, marker) {
    const query = new URLSearchParams({ q: `ix-ref:${marker}` });
    const response = await base.request(destination, connection, apiUrl(destination, `/search.json?${query}`));
    const result = base.requireFields(await base.readJson(response), [{ name: 'posts', type: 'object' }]);
    if (!Array.isArray(result.posts)) throw new AppError('SCHEMA_DRIFT', 'Platform response is missing required fields', { statusCode: 502, details: { missing_fields: ['posts'] } });
    const post = result.posts.find((item) => typeof item.raw === 'string' && item.raw.includes(`ix-ref:${marker}`));
    if (post) base.requireFields(post, [{ name: 'raw', type: 'string' }, { name: 'topic_id', type: 'number' }, { name: 'topic_slug', type: 'string' }]);
    return post ? { platform_post_id: String(post.topic_id), live_url: `${destination.config.base_url.replace(/\/$/, '')}/t/${post.topic_slug}/${post.topic_id}`, status: 'published' } : null;
  }
  return { key: manifest.key, manifest, validate: base.validate, publish, get_status, delete: remove, findByMarker };
}

const unsupported = async () => { throw new AppError('CONNECTOR_NOT_IMPLEMENTED', 'This connector method is not implemented', { statusCode: 501 }); };
module.exports = { manifest, createDiscourse, unsupported };
