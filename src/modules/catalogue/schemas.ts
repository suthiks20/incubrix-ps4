/**
 * Validates catalogue-import requests before any source is persisted.
 * CSV content is uploaded as base64 or fetched from a safe public URL.
 */
const source = {
  type: 'object',
  additionalProperties: false,
  properties: {
    upload: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'content_base64'],
      properties: { name: { type: 'string' }, content_base64: { type: 'string' } }
    },
    url: { type: 'string', format: 'uri' }
  },
  oneOf: [
    {
      required: ['upload'],
      not: { required: ['url'] }
    },
    {
      required: ['url'],
      not: { required: ['upload'] }
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
