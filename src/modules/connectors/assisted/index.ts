/**
 * Builds a human-ready posting pack for destinations that forbid automation.
 * It deliberately has no platform HTTP calls and no publish-ledger interaction.
 */
import AppError = require('../../../shared/errors/AppError');
import { createBase } from '../base';
import { loadManifest } from '../manifestLoader';
import type { Destination, Rendition } from '../types';
const manifest = loadManifest(__dirname + '/manifest.yaml');
function unsupported(): never {
  throw new AppError('CONNECTOR_NOT_IMPLEMENTED', 'A person posts with this connector; use build_assist_pack.', { statusCode: 501 });
}

function truncateWords(value: string, max: number): string {
  if (!max || value.length <= max) return value;
  const cut = value.slice(0, max + 1);
  const index = cut.lastIndexOf(' ');
  return (index > 0 ? cut.slice(0, index) : cut.slice(0, max)).trim();
}

function createAssisted(options: any = {}): any {
  const base = createBase(manifest, options);
  function build_assist_pack(rendition: Rendition, destination: Destination): any {
    const config = destination.config || {}; let caption = `${rendition.title || ''}\n\n${rendition.body || ''}`;
    if (destination.disclosure_required && rendition.ai_generated) caption += `\n\n${config.disclosure_text || 'Disclosure: this post was created with AI assistance.'}`;
    caption = truncateWords(caption, config.caption_max_chars);
    const checklist = [];
    if (config.rules_url) checklist.push({ item: `Read destination rules: ${config.rules_url}`, required: true, done: false });
    if (destination.frequency_cap) checklist.push({ item: `Respect ${destination.frequency_cap.posts} post(s) per ${destination.frequency_cap.per_days} day(s).`, required: true, done: false });
    if (destination.self_promo_allowed !== undefined) checklist.push({ item: destination.self_promo_allowed ? 'Self-promotion is allowed.' : 'Self-promotion is banned.', required: true, done: false });
    if (destination.link_policy) checklist.push({ item: `Follow link policy: ${destination.link_policy}.`, required: true, done: false });
    if (destination.disclosure_required) checklist.push({ item: 'Include the required AI disclosure.', required: true, done: false });
    if (destination.language) checklist.push({ item: `Post in ${destination.language}.`, required: true, done: false });
    checklist.push({ item: 'Delete or report the post URL back to IncuBrix', required: true, done: false });
    return { files: (rendition.media || []).map((media, index) => ({ name: media.name || `media-${index + 1}`, url: media.url, type: media.type })), caption, deep_link: config.submit_url || destination.url, checklist };
  }
  return { key: manifest.key, manifest, validate: base.validate, build_assist_pack, publish: unsupported, get_status: unsupported, delete: unsupported, findByMarker: unsupported };
}
export { manifest, createAssisted, createAssisted as createConnector, unsupported };
