/**
 * Validates catalogue-import requests before any source is persisted.
 * CSV content is uploaded as base64 or fetched from a safe public URL.
 */
const source = {
  type: 'object',
  additionalProperties: false,
  oneOf: [
    {
      required: ['upload'],
      properties: {
        upload: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'content_base64'],
          properties: { name: { type: 'string' }, content_base64: { type: 'string' } }
        }
      }
    },
    {
      required: ['url'],
      properties: { url: { type: 'string', format: 'uri' } }
    }
  ]
};

const importRequest = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['source'],
    properties: { source }
  }
};

export { importRequest };
