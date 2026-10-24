/**
 * Publishes video items into the MRSS simulation feed and reconciles by guid.
 * The published guid is an opaque marker derived from the idempotency key.
 */
import AppError = require('../../../shared/errors/AppError');
import { createBase } from '../base';
import { markerFor } from '../commons/marker';
import { loadManifest } from '../manifestLoader';
import type { Connection, Destination, Rendition, Violation } from '../types';

const manifest = loadManifest(__dirname + '/manifest.yaml');

function createMrss(options: any = {}): any {
  const base = createBase(manifest, { ...options, secretFields: ['api_key'] });

  function destinationId(destination: Destination): string {
    return String(destination.id || destination.config.base_url);
  }

  function apiUrl(destination: Destination, suffix: string): string {
    return `${destination.config.base_url.replace(/\/$/, '')}${suffix}`;
  }

  function validate(rendition: Rendition, surface?: string, destination?: Destination): Violation[] {
    const violations = base.validate(rendition, surface, destination);
    if (!Array.isArray(rendition.media) || rendition.media.length === 0) {
      violations.push({
        field: 'media',
        code: 'required',
        message: 'At least one video or image media item is required'
      });
    }
    return violations;
  }

  async function request(
    destination: Destination,
    connection: Connection,
    suffix: string,
    init: any = {}
  ): Promise<any> {
    return base.request(destination, connection, apiUrl(destination, suffix), {
      ...init,
      headers: {
        ...(init.headers || {}),
        authorization: `Bearer ${connection.api_key || ''}`
      }
    });
  }

  function requireItem(value: any): any {
    const item = base.requireFields(value, [{ name: 'item', type: 'object' }]).item;
    base.requireFields(item, [
      { name: 'id', type: 'string' },
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'link', type: 'string' },
      { name: 'guid', type: 'string' },
      { name: 'media_url', type: 'string' },
      { name: 'media_type', type: 'string' }
    ]);
    return item;
  }

  function liveUrl(destination: Destination, id: string): string {
    const origin = destination.config.feed_base_url || 'http://localhost:8000';
    return `${String(origin).replace(/\/$/, '')}/feeds/${encodeURIComponent(destinationId(destination))}.xml#${id}`;
  }

  async function publish(
    rendition: Rendition,
    destination: Destination,
    connection: Connection,
    idempotencyKey: string
  ): Promise<any> {
    const marker = markerFor(idempotencyKey);
    const media = rendition.media?.[0];
    const response = await request(destination, connection, '/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        destination_id: destinationId(destination),
        title: rendition.title,
        description: rendition.body,
        link: rendition.canonical_url || rendition.links?.[0] || destination.url,
        guid: marker,
        media_url: media?.url,
        media_type: media?.type
      })
    });
    const item = requireItem(await base.readJson(response));
    return {
      platform_post_id: item.id,
      live_url: liveUrl(destination, item.id),
      status: 'published',
      marker
    };
  }

  async function get_status(
    destination: Destination,
    connection: Connection,
    id: string
  ): Promise<any> {
    let response;
    try {
      response = await request(
        destination,
        connection,
        `/items/${encodeURIComponent(id)}?destination_id=${encodeURIComponent(destinationId(destination))}`
      );
    } catch (error: any) {
      if (error.code === 'PLATFORM_CONTENT_REJECTED' && error.details.platform_status === 404) {
        return { status: 'deleted', live_url: null };
      }
      throw error;
    }
    const item = requireItem(await base.readJson(response));
    return { status: 'published', live_url: liveUrl(destination, item.id) };
  }

  async function remove(
    destination: Destination,
    connection: Connection,
    id: string
  ): Promise<any> {
    const response = await request(
      destination,
      connection,
      `/items/${encodeURIComponent(id)}?destination_id=${encodeURIComponent(destinationId(destination))}`,
      { method: 'DELETE' }
    );
    return base.requireFields(await base.readJson(response), [
      { name: 'deleted', type: 'boolean' }
    ]);
  }

  async function findByMarker(
    destination: Destination,
    connection: Connection,
    marker: string
  ): Promise<any> {
    const query = new URLSearchParams({
      destination_id: destinationId(destination),
      guid: marker
    });
    const response = await request(destination, connection, `/items?${query}`);
    const result = base.requireFields(await base.readJson(response), [{ name: 'items', type: 'object' }]);
    if (!Array.isArray(result.items)) {
      throw new AppError('SCHEMA_DRIFT', 'Platform response is missing required fields', {
        statusCode: 502,
        details: { missing_fields: ['items'] }
      });
    }
    if (!result.items.length) return null;
    const item = requireItem({ item: result.items[0] });
    return { platform_post_id: item.id, live_url: liveUrl(destination, item.id), status: 'published' };
  }

  return {
    key: manifest.key,
    manifest,
    validate,
    publish,
    get_status,
    delete: remove,
    findByMarker
  };
}

const unsupported = async (): Promise<never> => {
  throw new AppError('CONNECTOR_NOT_IMPLEMENTED', 'This connector method is not implemented', {
    statusCode: 501
  });
};

export { manifest, createMrss, createMrss as createConnector, unsupported };
