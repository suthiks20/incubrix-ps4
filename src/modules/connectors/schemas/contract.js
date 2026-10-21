/**
 * Defines the permissive connector contract request envelope.
 * Unknown contract properties are accepted for forward-compatible payloads.
 */
module.exports = {
  body: {
    type: 'object', additionalProperties: true,
    properties: {
      idempotency_key: { type: 'string' }, destination_id: { type: 'string' }, destination_ref: { type: 'string' }, base_url: { type: 'string' },
      destination: { type: 'object', additionalProperties: true },
      connection: { type: 'object', additionalProperties: true, properties: { api_key: { type: 'string' }, api_username: { type: 'string' } } },
      rendition: {
        type: 'object', additionalProperties: true,
        properties: {
          title: { type: 'string' }, body: { type: 'string' }, language: { type: 'string' },
          is_promotional: { type: 'boolean' }, ai_generated: { type: 'boolean' }, canonical_url: { type: 'string' },
          links: { type: 'array', items: { type: 'string' } },
          media: { type: 'array', items: { type: 'object', required: ['url', 'type'], additionalProperties: true, properties: { url: { type: 'string' }, type: { type: 'string' } } } }
        }
      },
      platform_post_id: { type: 'string' }
    }
  }
};
