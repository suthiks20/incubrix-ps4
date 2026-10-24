/**
 * Publishes Hashnode posts through GraphQL and reconciles by an opaque slug marker.
 * GraphQL errors are inspected even when the HTTP status is successful.
 */
import AppError = require('../../../shared/errors/AppError');
import { createBase } from '../base';
import { markerFor } from '../commons/marker';
import { loadManifest } from '../manifestLoader';
import type { Connection, Destination, Rendition } from '../types';

const manifest = loadManifest(__dirname + '/manifest.yaml');

function createHashnode(options: any = {}): any {
  const base = createBase(manifest, {
    ...options,
    authHeaders: (connection: Connection) => ({ authorization: connection.api_key || '' }),
    secretFields: ['api_key']
  });

  async function graphql(
    destination: Destination,
    connection: Connection,
    query: string,
    variables: Record<string, unknown>
  ): Promise<any> {
    const response = await base.request(destination, connection, destination.config.base_url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    const result = await base.readJson(response);
    if (Array.isArray(result.errors) && result.errors.length) {
      const message = String(result.errors[0].message || '');
      const status = response.status;
      const code = /invalid auth|unauthorized|token revoked/i.test(message)
        ? 'CONNECTION_AUTH_EXPIRED'
        : /rate.?limit|too many requests/i.test(message) || status === 429
          ? 'PLATFORM_RATE_LIMIT'
          : /too long|invalid content|rejected/i.test(message)
            ? 'PLATFORM_CONTENT_REJECTED'
            : status >= 500
              ? 'PLATFORM_UNAVAILABLE'
              : 'PLATFORM_CONTENT_REJECTED';
      throw new AppError(code, 'Hashnode GraphQL request failed', {
        statusCode: code === 'CONNECTION_AUTH_EXPIRED' ? 401 : code === 'PLATFORM_RATE_LIMIT' ? 429 : code === 'PLATFORM_UNAVAILABLE' ? 503 : 422,
        retryable: code === 'PLATFORM_RATE_LIMIT' || code === 'PLATFORM_UNAVAILABLE',
        details: { platform_message: message }
      });
    }
    return base.requireFields(result, [{ name: 'data', type: 'object' }]).data;
  }

  function requirePost(value: any): any {
    const post = base.requireFields(value, [{ name: 'post', type: 'object' }]).post;
    return base.requireFields(post, [
      { name: 'id', type: 'string' },
      { name: 'url', type: 'string' },
      { name: 'slug', type: 'string' },
      { name: 'title', type: 'string' }
    ]);
  }

  async function publish(
    rendition: Rendition,
    destination: Destination,
    connection: Connection,
    key: string
  ): Promise<any> {
    const marker = markerFor(key);
    const data = await graphql(destination, connection,
      'mutation PublishPost($input: PublishPostInput!) { publishPost(input: $input) { post { id url slug title } } }',
      {
        input: {
          publicationId: destination.config.publication_id,
          title: rendition.title,
          contentMarkdown: `${rendition.body}\n\n<!-- ix_ref:${marker} -->`,
          slug: `ix-${marker}`,
          tags: (rendition.tags || []).map((name) => ({ name }))
        }
      });
    const result = base.requireFields(data, [{ name: 'publishPost', type: 'object' }]);
    const post = requirePost(result.publishPost);
    return { platform_post_id: post.id, live_url: post.url, status: 'published', marker };
  }

  async function get_status(
    destination: Destination,
    connection: Connection,
    id: string
  ): Promise<any> {
    const data = await graphql(destination, connection,
      'query Post($id: ID!) { post(id: $id) { id url slug title } }', { id });
    if (!data.post) return { status: 'deleted', live_url: null };
    const post = requirePost({ post: data.post });
    return { status: 'published', live_url: post.url };
  }

  async function remove(
    destination: Destination,
    connection: Connection,
    id: string
  ): Promise<any> {
    const data = await graphql(destination, connection,
      'mutation RemovePost($input: RemovePostInput!) { removePost(input: $input) { post { id } } }',
      { input: { postId: id } });
    const result = base.requireFields(data, [{ name: 'removePost', type: 'object' }]);
    base.requireFields(result.removePost, [{ name: 'post', type: 'object' }]);
    base.requireFields(result.removePost.post, [{ name: 'id', type: 'string' }]);
    return { deleted: true };
  }

  async function findByMarker(
    destination: Destination,
    connection: Connection,
    marker: string
  ): Promise<any> {
    const data = await graphql(destination, connection,
      'query PostBySlug($slug: String!) { postBySlug(slug: $slug) { id url slug title } }',
      { slug: `ix-${marker}` });
    if (!data.postBySlug) return null;
    const post = requirePost({ post: data.postBySlug });
    return { platform_post_id: post.id, live_url: post.url, status: 'published' };
  }

  return {
    key: manifest.key, manifest, validate: base.validate, publish, get_status, delete: remove, findByMarker
  };
}

const unsupported = async (): Promise<never> => {
  throw new AppError('CONNECTOR_NOT_IMPLEMENTED', 'This connector method is not implemented', {
    statusCode: 501
  });
};

export { manifest, createHashnode, createHashnode as createConnector, unsupported };
