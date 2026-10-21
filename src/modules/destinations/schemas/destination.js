/**
 * Defines the shared destination JSON Schema properties.
 * Requests and responses reuse these fields to keep the API contract aligned.
 */
const { LEVELS, LINK_POLICIES } = require('../commons/constants');

const frequencyCap = {
  type: 'object', additionalProperties: false, required: ['posts', 'per_days'],
  properties: { posts: { type: 'integer', minimum: 1 }, per_days: { type: 'integer', minimum: 1 } }
};
const requestProperties = {
  name: { type: 'string', minLength: 1 }, url: { type: 'string', minLength: 1 }, platform_key: { type: 'string', minLength: 1 },
  surface: { type: 'string' }, category: { type: 'string', nullable: true }, audience_tags: { type: 'array', items: {} },
  language: { type: 'string' }, geo: { type: 'string', nullable: true }, est_audience: { type: 'integer', nullable: true },
  rules_url: { type: 'string', nullable: true }, frequency_cap: { ...frequencyCap, nullable: true }, self_promo_allowed: { type: 'boolean' },
  link_policy: { type: 'string', enum: LINK_POLICIES }, disclosure_required: { type: 'boolean' }, automation_allowed: { type: 'boolean' },
  connector_key: { type: 'string', minLength: 1 }, config: { type: 'object', additionalProperties: true },
  connection_ref: { type: 'string', nullable: true, description: 'Name of the stored connection or secret. Never put a secret value here.' },
  relevance_score: { type: 'integer', minimum: 1, maximum: 5, nullable: true }, relevance_reason: { type: 'string', nullable: true },
  enabled: { type: 'boolean' }
};
const responseProperties = {
  id: { type: 'string', format: 'uuid' }, ...requestProperties,
  level: { type: 'string', enum: LEVELS }, last_certified_at: { type: 'string', format: 'date-time', nullable: true }, demoted: { type: 'boolean' },
  url_normalized: { type: 'string' }, created_at: { type: 'string', format: 'date-time' }, updated_at: { type: 'string', format: 'date-time' }
};

module.exports = { frequencyCap, requestProperties, responseProperties };
