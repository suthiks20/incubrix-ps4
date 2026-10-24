/**
 * Publishes Slack messages and reconciles them using a private metadata marker.
 * Slack API errors may arrive in HTTP 200 response bodies.
 */
import AppError = require('../../../shared/errors/AppError');
import { createBase } from '../base';
import { markerFor } from '../commons/marker';
import { loadManifest } from '../manifestLoader';
import type { Connection, Destination, Rendition, Violation } from '../types';

const manifest = loadManifest(__dirname + '/manifest.yaml');

function createSlack(options: any = {}): any {
  const base = createBase(manifest, { ...options, secretFields: ['bot_token'] });

  function endpoint(destination: Destination, path: string): string {
    return `${destination.config.base_url.replace(/\/$/, '')}/api/${path}`;
  }

  async function slackRequest(
    destination: Destination,
    connection: Connection,
    method: string,
    body: Record<string, unknown>
  ): Promise<any> {
    const response = await base.request(destination, connection, endpoint(destination, method), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${connection.bot_token || ''}` },
      body: JSON.stringify(body)
    });
    const result = await base.readJson(response);
    if (result.ok !== true) {
      const reason = String(result.error || 'unknown_error');
      const code = ['invalid_auth', 'token_revoked'].includes(reason)
        ? 'CONNECTION_AUTH_EXPIRED'
        : reason === 'ratelimited'
          ? 'PLATFORM_RATE_LIMIT'
          : ['msg_too_long', 'invalid_blocks'].includes(reason)
            ? 'PLATFORM_CONTENT_REJECTED'
            : 'PLATFORM_UNAVAILABLE';
      throw new AppError(code, 'Slack rejected the API request', {
        statusCode: code === 'CONNECTION_AUTH_EXPIRED' ? 401
          : code === 'PLATFORM_RATE_LIMIT' ? 429
            : code === 'PLATFORM_UNAVAILABLE' ? 503 : 422,
        retryable: code === 'PLATFORM_RATE_LIMIT' || code === 'PLATFORM_UNAVAILABLE',
        details: {
          platform_error: reason,
          ...(response.headers.get('retry-after')
            ? { retry_after_seconds: Number(response.headers.get('retry-after')) }
            : {})
        }
      });
    }
    return result;
  }

  function requireMessage(value: any): any {
    return base.requireFields(value, [
      { name: 'ts', type: 'string' },
      { name: 'channel', type: 'string' },
      { name: 'text', type: 'string' }
    ]);
  }

  function validate(rendition: Rendition, surface?: string, destination?: Destination): Violation[] {
    const violations = base.validate(rendition, surface, destination);
    if (typeof rendition.body === 'string' && rendition.body.length > 40000) {
      violations.push({
        field: 'body',
        code: 'max_length',
        message: 'Slack message must be at most 40000 characters'
      });
    }
    return violations;
  }

  async function publish(
    rendition: Rendition,
    destination: Destination,
    connection: Connection,
    key: string
  ): Promise<any> {
    const marker = markerFor(key);
    const channel = destination.config.channel_id;
    if (typeof channel !== 'string' || !channel) {
      throw new AppError('VALIDATION_ERROR', 'Slack destination requires config.channel_id', {
        statusCode: 400,
        details: { fields: ['config.channel_id'] }
      });
    }
    const result = await slackRequest(destination, connection, 'chat.postMessage', {
      channel,
      text: `${rendition.title}\n${rendition.body}\n[incubrix:${marker}]`,
      metadata: { event_type: 'incubrix_publish', event_payload: { marker } }
    });
    const message = base.requireFields(result, [{ name: 'message', type: 'object' }]).message;
    requireMessage(message);
    return {
      platform_post_id: message.ts,
      live_url: `${destination.config.base_url.replace(/\/$/, '')}/archives/${channel}/p${message.ts.replace('.', '')}`,
      status: 'published',
      marker
    };
  }

  async function findByMarker(
    destination: Destination,
    connection: Connection,
    marker: string
  ): Promise<any> {
    const result = await slackRequest(destination, connection, 'conversations.history', {
      channel: destination.config.channel_id,
      limit: 100
    });
    const messages = base.requireFields(result, [{ name: 'messages', type: 'object' }]).messages;
    if (!Array.isArray(messages)) {
      throw new AppError('SCHEMA_DRIFT', 'Slack response is missing required fields', {
        statusCode: 502,
        details: { missing_fields: ['messages'] }
      });
    }
    const message = messages.find((item: any) => item.metadata?.event_payload?.marker === marker);
    if (!message) return null;
    requireMessage(message);
    return {
      platform_post_id: message.ts,
      live_url: `${destination.config.base_url.replace(/\/$/, '')}/archives/${message.channel}/p${message.ts.replace('.', '')}`,
      status: 'published'
    };
  }

  async function get_status(
    destination: Destination,
    connection: Connection,
    id: string
  ): Promise<any> {
    const result = await slackRequest(destination, connection, 'conversations.history', {
      channel: destination.config.channel_id,
      limit: 100
    });
    const messages = base.requireFields(result, [{ name: 'messages', type: 'object' }]).messages;
    if (!Array.isArray(messages)) {
      throw new AppError('SCHEMA_DRIFT', 'Slack response is missing required fields', {
        statusCode: 502,
        details: { missing_fields: ['messages'] }
      });
    }
    const message = messages.find((item: any) => item.ts === id);
    if (!message) return { status: 'deleted', live_url: null };
    requireMessage(message);
    return {
      status: 'published',
      live_url: `${destination.config.base_url.replace(/\/$/, '')}/archives/${message.channel}/p${id.replace('.', '')}`
    };
  }

  async function remove(
    destination: Destination,
    connection: Connection,
    id: string
  ): Promise<any> {
    const result = await slackRequest(destination, connection, 'chat.delete', {
      channel: destination.config.channel_id,
      ts: id
    });
    base.requireFields(result, [{ name: 'channel', type: 'string' }, { name: 'ts', type: 'string' }]);
    return { deleted: true };
  }

  return {
    key: manifest.key, manifest, validate, publish, get_status, delete: remove, findByMarker
  };
}

const unsupported = async (): Promise<never> => {
  throw new AppError('CONNECTOR_NOT_IMPLEMENTED', 'This connector method is not implemented', {
    statusCode: 501
  });
};

export { manifest, createSlack, createSlack as createConnector, unsupported };
