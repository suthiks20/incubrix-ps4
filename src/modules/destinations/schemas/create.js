/**
 * Validates destination creation bodies and the created resource response.
 * Server-managed identity and timestamp fields cannot be supplied by clients.
 */
const { requestProperties, responseProperties } = require('./destination');
module.exports = {
  body: { type: 'object', additionalProperties: false, required: ['name', 'url', 'platform_key', 'connector_key'], properties: requestProperties },
  response: { 201: { type: 'object', additionalProperties: false, required: ['id', 'name', 'url', 'url_normalized', 'platform_key', 'surface', 'audience_tags', 'language', 'self_promo_allowed', 'link_policy', 'disclosure_required', 'automation_allowed', 'connector_key', 'config', 'level', 'enabled', 'demoted', 'created_at', 'updated_at'], properties: responseProperties } }
};
