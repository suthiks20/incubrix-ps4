/**
 * Publishes Lemmy posts with a cached login token and marker-based recovery.
 * The API response shapes match the local-instance spike in spike/REPORT.md.
 */
import AppError = require('../../../shared/errors/AppError');
import { createBase } from '../base';
import { markerFor } from '../commons/marker';
import { loadManifest } from '../manifestLoader';
import type { Connection, Destination, Rendition } from '../types';

const manifest = loadManifest(__dirname + '/manifest.yaml');

function createLemmy(options: any = {}): any {
  const tokens = new Map<string, string>();
  const base = createBase(manifest, { ...options, secretFields: ['api_key', 'password'] });

  function apiUrl(destination: Destination, path: string): string {
    return `${destination.config.base_url.replace(/\/$/, '')}${path}`;
  }

  function credentials(connection: Connection): any {
    return { username_or_email: connection.username || connection.api_username, password: connection.password || connection.api_key };
  }

  async function token(destination: Destination, connection: Connection): Promise<string> {
    const login = credentials(connection);
    const cacheKey = `${destination.config.base_url}:${login.username_or_email}:${login.password}`;
    if (tokens.has(cacheKey)) return tokens.get(cacheKey) as string;
    const response = await base.request(destination, connection, apiUrl(destination, '/api/v3/user/login'), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(login)
    });
    const result = base.requireFields(await base.readJson(response), [{ name: 'jwt', type: 'string' }]);
    tokens.set(cacheKey, result.jwt);
    return result.jwt;
  }

  async function request(destination: Destination, connection: Connection, path: string, init: any = {}): Promise<any> {
    const jwt = await token(destination, connection);
    return base.request(destination, connection, apiUrl(destination, path), {
      ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${jwt}` }
    });
  }

  async function communityId(destination: Destination, connection: Connection): Promise<number> {
    const name = destination.config.community_name || 'incubrix_test';
    const response = await request(destination, connection, `/api/v3/community?name=${encodeURIComponent(name)}`);
    const result = base.requireFields(await base.readJson(response), [{ name: 'community_view', type: 'object' }]);
    return base.requireFields(result.community_view, [{ name: 'community', type: 'object' }]).community.id;
  }

  async function publish(rendition: Rendition, destination: Destination, connection: Connection, key: string): Promise<any> {
    const marker = markerFor(key);
    const response = await request(destination, connection, '/api/v3/post', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ community_id: await communityId(destination, connection), name: rendition.title,
        body: `${rendition.body}\n\n<!-- ix_ref:${marker} -->` })
    });
    const result = base.requireFields(await base.readJson(response), [{ name: 'post_view', type: 'object' }]);
    const post = base.requireFields(result.post_view, [{ name: 'post', type: 'object' }]).post;
    base.requireFields(post, [{ name: 'id', type: 'number' }]);
    return { platform_post_id: String(post.id), live_url: `${destination.config.base_url}/post/${post.id}`, status: 'published', marker };
  }

  async function get_status(destination: Destination, connection: Connection, id: string): Promise<any> {
    const response = await request(destination, connection, `/api/v3/post?id=${encodeURIComponent(id)}`);
    const result = base.requireFields(await base.readJson(response), [{ name: 'post_view', type: 'object' }]);
    const post = base.requireFields(result.post_view, [{ name: 'post', type: 'object' }]).post;
    base.requireFields(post, [{ name: 'id', type: 'number' }, { name: 'deleted', type: 'boolean' }]);
    if (post.deleted) return { status: 'deleted', live_url: null };
    return { status: 'published', live_url: `${destination.config.base_url}/post/${post.id}` };
  }

  async function remove(destination: Destination, connection: Connection, id: string): Promise<any> {
    await request(destination, connection, '/api/v3/post/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ post_id: Number(id), deleted: true })
    });
    return { deleted: true };
  }

  async function findByMarker(destination: Destination, connection: Connection, marker: string): Promise<any> {
    const response = await request(destination, connection, `/api/v3/search?q=${encodeURIComponent(`ix_ref:${marker}`)}&type_=Posts`);
    const result = base.requireFields(await base.readJson(response), [{ name: 'posts', type: 'object' }]);
    if (!Array.isArray(result.posts)) throw new AppError('SCHEMA_DRIFT', 'Platform response is missing required fields', { statusCode: 502, details: { missing_fields: ['posts'] } });
    const view = result.posts.find((entry: any) => entry.post && typeof entry.post.body === 'string' && entry.post.body.includes(`ix_ref:${marker}`));
    if (!view) return null;
    const post = base.requireFields(view, [{ name: 'post', type: 'object' }]).post;
    base.requireFields(post, [{ name: 'id', type: 'number' }]);
    return { platform_post_id: String(post.id), live_url: `${destination.config.base_url}/post/${post.id}`, status: 'published' };
  }

  return { key: manifest.key, manifest, validate: base.validate, publish, get_status, delete: remove, findByMarker };
}

const unsupported = async (): Promise<never> => { throw new AppError('CONNECTOR_NOT_IMPLEMENTED', 'This connector method is not implemented', { statusCode: 501 }); };
export { manifest, createLemmy, createLemmy as createConnector, unsupported };
