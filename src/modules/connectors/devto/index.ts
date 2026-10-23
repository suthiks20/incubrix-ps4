/**
 * Publishes Dev.to articles and reconciles them with an opaque body marker.
 * Dev.to deletion means unpublish; get_status verifies that the article is gone.
 */
import AppError = require('../../../shared/errors/AppError');
import { createBase } from '../base';
import { markerFor } from '../commons/marker';
import { loadManifest } from '../manifestLoader';
import type { Connection, Destination, Rendition } from '../types';

const manifest = loadManifest(__dirname + '/manifest.yaml');

function createDevto(options: any = {}): any {
  const base = createBase(manifest, {
    ...options,
    authHeaders: (connection: Connection) => ({ 'api-key': connection.api_key }),
    secretFields: ['api_key']
  });

  function apiUrl(destination: Destination, suffix: string): string {
    return `${destination.config.base_url.replace(/\/$/, '')}${suffix}`;
  }

  function deleted(error: any): boolean {
    return error.code === 'PLATFORM_CONTENT_REJECTED' && error.details.platform_status === 404;
  }

  async function publish(
    rendition: Rendition,
    destination: Destination,
    connection: Connection,
    idempotencyKey: string
  ): Promise<any> {
    const marker = markerFor(idempotencyKey);
    const article: any = {
      title: rendition.title,
      body_markdown: `${rendition.body}\n\n<!-- ix_ref:${marker} -->`,
      published: true
    };
    if (rendition.canonical_url) article.canonical_url = rendition.canonical_url;
    if (rendition.tags) article.tags = rendition.tags.slice(0, 4);
    const response = await base.request(destination, connection, apiUrl(destination, '/api/articles'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ article })
    });
    const result = base.requireFields(await base.readJson(response), [
      { name: 'id', type: 'number' },
      { name: 'url', type: 'string' }
    ]);
    return { platform_post_id: String(result.id), live_url: result.url, status: 'published', marker };
  }

  async function get_status(destination: Destination, connection: Connection, id: string): Promise<any> {
    let response;
    try {
      response = await base.request(destination, connection, apiUrl(destination, `/api/articles/${encodeURIComponent(id)}`));
    } catch (error) {
      if (deleted(error)) return { status: 'deleted', live_url: null };
      throw error;
    }
    const result = base.requireFields(await base.readJson(response), [
      { name: 'id', type: 'number' },
      { name: 'url', type: 'string' },
      { name: 'published', type: 'boolean' }
    ]);
    if (!result.published) return { status: 'deleted', live_url: null };
    return { status: 'published', live_url: result.url };
  }

  async function remove(destination: Destination, connection: Connection, id: string): Promise<any> {
    try {
      await base.request(destination, connection, apiUrl(destination, `/api/articles/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ article: { published: false } })
      });
    } catch (error) {
      if (!deleted(error)) throw error;
    }
    return { deleted: true };
  }

  async function findByMarker(destination: Destination, connection: Connection, marker: string): Promise<any> {
    const response = await base.request(destination, connection, apiUrl(destination, '/api/articles/me/all'));
    const articles = await base.readJson(response);
    if (!Array.isArray(articles)) {
      throw new AppError('SCHEMA_DRIFT', 'Platform response is missing required fields', {
        statusCode: 502,
        details: { missing_fields: ['articles'] }
      });
    }
    const article = articles.find((item) => item.published && item.body_markdown.includes(`ix_ref:${marker}`));
    if (!article) return null;
    base.requireFields(article, [{ name: 'id', type: 'number' }, { name: 'url', type: 'string' }]);
    return { platform_post_id: String(article.id), live_url: article.url, status: 'published' };
  }

  return { key: manifest.key, manifest, validate: base.validate, publish, get_status, delete: remove, findByMarker };
}

const unsupported = async (): Promise<never> => {
  throw new AppError('CONNECTOR_NOT_IMPLEMENTED', 'This connector method is not implemented', { statusCode: 501 });
};

export { manifest, createDevto, createDevto as createConnector, unsupported };
