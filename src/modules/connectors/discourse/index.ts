/**
 * Publishes and manages topics through the Discourse REST API.
 * The marker in each post supports safe recovery after ambiguous network failures.
 */
import crypto from 'crypto';
import AppError = require('../../../shared/errors/AppError');
import { createBase } from '../base';
import { loadManifest } from '../manifestLoader';
import type { Connection, Destination, Rendition } from '../types';
const manifest = loadManifest(__dirname + '/manifest.yaml');

function createDiscourse(options: any = {}): any {
  const base = createBase(manifest, { ...options, authHeaders: (connection) => ({ 'Api-Key': connection.api_key, 'Api-Username': connection.api_username }), secretFields: ['api_key', 'api_username'] });
  function apiUrl(destination: Destination, path: string): string {
    return `${destination.config.base_url.replace(/\/$/, '')}${path}`;
  }
  async function publish(rendition: Rendition, destination: Destination, connection: Connection, idempotencyKey: string): Promise<any> {
    const marker = crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16);
    const raw = `${rendition.body}\n\nix-ref:${marker}`;
    const response = await base.request(destination, connection, apiUrl(destination, '/posts.json'), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: rendition.title, raw, ...(destination.category ? { category: destination.category } : {}) })
    });
    const result = base.requireFields(await base.readJson(response), [{ name: 'id', type: 'number' }, { name: 'topic_id', type: 'number' }, { name: 'topic_slug', type: 'string' }]);
    return { platform_post_id: String(result.topic_id), live_url: `${destination.config.base_url.replace(/\/$/, '')}/t/${result.topic_slug}/${result.topic_id}`, status: 'published', marker };
  }
  async function get_status(destination: Destination, connection: Connection, id: string): Promise<any> {
    let response;
    try { response = await base.request(destination, connection, apiUrl(destination, `/t/${encodeURIComponent(id)}.json`)); }
    catch (error) { if (error.code === 'PLATFORM_CONTENT_REJECTED' && error.details.platform_status === 404) return { status: 'deleted', live_url: null }; throw error; }
    const result = base.requireFields(await base.readJson(response), [{ name: 'id', type: 'number' }, { name: 'slug', type: 'string' }]);
    return { status: 'published', live_url: `${destination.config.base_url.replace(/\/$/, '')}/t/${result.slug}/${result.id}` };
  }
  async function fetch_metrics(destination: Destination, connection: Connection, id: string): Promise<any> {
    const response = await base.request(destination, connection, apiUrl(destination, `/t/${encodeURIComponent(id)}.json`));
    const result = base.requireFields(await base.readJson(response), [
      { name: 'views', type: 'number' },
      { name: 'like_count', type: 'number' },
      { name: 'reply_count', type: 'number' }
    ]);
    return {
      views: result.views,
      likes: result.like_count,
      comments: result.reply_count,
      shares: result.shares_count || 0,
      saves: result.saves_count || 0,
      watch_time_s: result.watch_time_s || 0,
      clicks: result.clicks || 0
    };
  }
  async function remove(destination: Destination, connection: Connection, id: string): Promise<any> {
    try { await base.request(destination, connection, apiUrl(destination, `/t/${encodeURIComponent(id)}.json`), { method: 'DELETE' }); }
    catch (error) { if (error.code !== 'PLATFORM_CONTENT_REJECTED' || error.details.platform_status !== 404) throw error; }
    return { deleted: true };
  }
  async function findByMarker(destination: Destination, connection: Connection, marker: string): Promise<any> {
    const query = new URLSearchParams({ q: `ix-ref:${marker}` });
    const response = await base.request(destination, connection, apiUrl(destination, `/search.json?${query}`));
    const result = base.requireFields(await base.readJson(response), [{ name: 'posts', type: 'object' }]);
    if (!Array.isArray(result.posts)) throw new AppError('SCHEMA_DRIFT', 'Platform response is missing required fields', { statusCode: 502, details: { missing_fields: ['posts'] } });
    const post = result.posts.find((item) => typeof item.raw === 'string' && item.raw.includes(`ix-ref:${marker}`));
    if (post) base.requireFields(post, [{ name: 'raw', type: 'string' }, { name: 'topic_id', type: 'number' }, { name: 'topic_slug', type: 'string' }]);
    return post ? { platform_post_id: String(post.topic_id), live_url: `${destination.config.base_url.replace(/\/$/, '')}/t/${post.topic_slug}/${post.topic_id}`, status: 'published' } : null;
  }
  return {
    key: manifest.key, manifest, validate: base.validate, publish, get_status,
    delete: remove, findByMarker, fetch_metrics
  };
}

const unsupported = async (): Promise<never> => {
  throw new AppError('CONNECTOR_NOT_IMPLEMENTED', 'This connector method is not implemented', { statusCode: 501 });
};

export { manifest, createDiscourse, createDiscourse as createConnector, unsupported };
