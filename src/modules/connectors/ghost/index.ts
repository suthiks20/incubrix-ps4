/**
 * Publishes Ghost Admin API drafts using a short-lived signed JWT.
 * Marker-derived slugs make reconciliation independent of response timing.
 */
import AppError = require('../../../shared/errors/AppError');
import { createBase } from '../base';
import { markerFor } from '../commons/marker';
import { loadManifest } from '../manifestLoader';
import { ghostJwt } from './ghostJwt';
import type { Connection, Destination, Rendition } from '../types';

const manifest = loadManifest(__dirname + '/manifest.yaml');

function html(body: string): string {
  const safe = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<p>${safe.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
}

function createGhost(options: any = {}): any {
  const base = createBase(manifest, {
    ...options,
    authHeaders: (connection: Connection) => ({ authorization: `Ghost ${ghostJwt(connection.api_key || '')}`, 'accept-version': 'v6.0' }),
    secretFields: ['api_key']
  });
  function apiUrl(destination: Destination, path: string): string { return `${destination.config.base_url.replace(/\/$/, '')}${path}`; }
  function deleted(error: any): boolean { return error.code === 'PLATFORM_CONTENT_REJECTED' && error.details.platform_status === 404; }
  async function publish(rendition: Rendition, destination: Destination, connection: Connection, key: string): Promise<any> {
    const slug = `ix-${markerFor(key)}`;
    const response = await base.request(destination, connection, apiUrl(destination, '/ghost/api/admin/posts/?source=html'), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ posts: [{ title: rendition.title, slug, html: html(rendition.body), status: 'draft' }] })
    });
    const result = base.requireFields(await base.readJson(response), [{ name: 'posts', type: 'object' }]);
    if (!Array.isArray(result.posts) || !result.posts[0]) throw new AppError('SCHEMA_DRIFT', 'Platform response is missing required fields', { statusCode: 502, details: { missing_fields: ['posts[0]'] } });
    const post = base.requireFields(result.posts[0], [{ name: 'id', type: 'string' }, { name: 'slug', type: 'string' }]);
    return { platform_post_id: post.id, live_url: `${destination.config.base_url}/p/${post.slug}/`, status: 'published', marker: slug };
  }
  async function get_status(destination: Destination, connection: Connection, id: string): Promise<any> {
    try {
      const response = await base.request(destination, connection, apiUrl(destination, `/ghost/api/admin/posts/${encodeURIComponent(id)}/?formats=html`));
      const result = base.requireFields(await base.readJson(response), [{ name: 'posts', type: 'object' }]);
      if (!Array.isArray(result.posts) || !result.posts[0]) throw new AppError('SCHEMA_DRIFT', 'Platform response is missing required fields', { statusCode: 502, details: { missing_fields: ['posts[0]'] } });
      const post = base.requireFields(result.posts[0], [{ name: 'id', type: 'string' }, { name: 'slug', type: 'string' }]);
      return { status: 'published', live_url: `${destination.config.base_url}/p/${post.slug}/` };
    } catch (error) { if (deleted(error)) return { status: 'deleted', live_url: null }; throw error; }
  }
  async function remove(destination: Destination, connection: Connection, id: string): Promise<any> {
    try { await base.request(destination, connection, apiUrl(destination, `/ghost/api/admin/posts/${encodeURIComponent(id)}/`), { method: 'DELETE' }); }
    catch (error) { if (!deleted(error)) throw error; }
    return { deleted: true };
  }
  async function findByMarker(destination: Destination, connection: Connection, marker: string): Promise<any> {
    const slug = `ix-${marker}`;
    try {
      const response = await base.request(destination, connection, apiUrl(destination, `/ghost/api/admin/posts/slug/${encodeURIComponent(slug)}/`));
      const result = base.requireFields(await base.readJson(response), [{ name: 'posts', type: 'object' }]);
      if (!Array.isArray(result.posts) || !result.posts[0]) return null;
      const post = base.requireFields(result.posts[0], [{ name: 'id', type: 'string' }, { name: 'slug', type: 'string' }]);
      return { platform_post_id: post.id, live_url: `${destination.config.base_url}/p/${post.slug}/`, status: 'published' };
    } catch (error) { if (deleted(error)) return null; throw error; }
  }
  return { key: manifest.key, manifest, validate: base.validate, publish, get_status, delete: remove, findByMarker };
}

const unsupported = async (): Promise<never> => { throw new AppError('CONNECTOR_NOT_IMPLEMENTED', 'This connector method is not implemented', { statusCode: 501 }); };
export { manifest, createGhost, createGhost as createConnector, unsupported };
