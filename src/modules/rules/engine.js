/**
 * Evaluates destination policy without database, clock, or network access.
 * The explicit inputs make publishing decisions deterministic and testable.
 */
const DEFAULT_DISCLOSURE = 'Disclosure: this post was created with AI assistance.';
function linkList(rendition) {
  const links = [...(rendition.links || [])];
  const matches = String(rendition.body || '').match(/https?:\/\/[^\s)\]]+/gi) || [];
  return [...new Set([...links, ...matches])];
}
function evaluate({ rendition, destination, history = { published_at: [] }, now }) {
  const result = { ...rendition, links: rendition.links ? [...rendition.links] : rendition.links };
  const reasons = [];
  let next_allowed_at = null;
  const add = (code, message, action, severity = 'block', details = {}) => reasons.push({ code, message, action, severity, ...(Object.keys(details).length ? { details } : {}) });
  if (destination.enabled === false) add('DESTINATION_DISABLED', 'Destination is disabled.', 'Enable the destination before publishing.');
  if (destination.demoted === true) add('DESTINATION_DEMOTED', 'Certification failed; this destination is excluded until recertified.', 'Recertify the destination.');
  if (destination.automation_allowed === false) add('AUTOMATION_NOT_ALLOWED', 'This destination requires assisted posting.', 'Use POST /connector/v1/assisted/build_assist_pack; a person must post.', 'warn');
  const current = new Date(now);
  const cap = destination.frequency_cap;
  if (cap && Number(cap.posts) > 0 && Number(cap.per_days) > 0) {
    const cutoff = current.getTime() - Number(cap.per_days) * 86400000;
    const dates = (history.published_at || []).map((value) => new Date(value)).filter((date) => !Number.isNaN(date.getTime()) && date.getTime() >= cutoff && date.getTime() <= current.getTime()).sort((a, b) => a - b);
    if (dates.length >= Number(cap.posts)) {
      next_allowed_at = new Date(dates[0].getTime() + Number(cap.per_days) * 86400000).toISOString();
      add('DEST_RULE_FREQUENCY_CAP', `The limit is ${cap.posts} post(s) per ${cap.per_days} day(s); next allowed at ${next_allowed_at}.`, `Wait until ${next_allowed_at}.`);
    }
  }
  let promotional;
  let promo_source;
  if (typeof rendition.is_promotional === 'boolean') { promotional = rendition.is_promotional; promo_source = 'flag'; }
  else {
    const text = `${rendition.title || ''} ${rendition.body || ''}`.toLowerCase();
    promotional = /\b(buy now|discount|sign up|free trial|limited offer|use code|check out our)\b/.test(text) || (String(rendition.body || '').match(/https?:\/\/[^\s)\]]+/gi) || []).length >= 2;
    promo_source = 'heuristic';
  }
  if (promotional) add('PROMOTION_CLASSIFIED', 'Content was classified as promotional.', 'Apply destination promotion policy.', 'warn', { promo_source });
  if (promotional && destination.self_promo_allowed === false) add('SELF_PROMOTION_NOT_ALLOWED', 'Promotional content is not allowed by this destination.', 'Remove promotional content or choose an allowed destination.');
  const links = linkList(rendition);
  if ((destination.link_policy === 'no_links' && links.length) || (destination.link_policy === 'max_one_link' && links.length > 1)) add('LINK_POLICY_VIOLATION', `Link policy ${destination.link_policy} was violated.`, 'Remove links to meet the destination link policy.');
  if (destination.disclosure_required && rendition.ai_generated === true) {
    const disclosure = destination.config && destination.config.disclosure_text || DEFAULT_DISCLOSURE;
    if (!String(result.body || '').includes(disclosure)) {
      result.body = `${result.body || ''}\n\n${disclosure}`;
      add('AI_DISCLOSURE_APPENDED', 'Required AI disclosure was appended to the post.', 'Review the disclosure before publishing.', 'fixed');
    }
  } else if (destination.disclosure_required && typeof rendition.ai_generated !== 'boolean') add('AI_DISCLOSURE_UNKNOWN', 'AI-generated status is required for this destination.', 'Set ai_generated to true or false.');
  if (destination.language && rendition.language && destination.language.split('-')[0].toLowerCase() !== rendition.language.split('-')[0].toLowerCase()) add('LANGUAGE_MISMATCH', `Rendition language ${rendition.language} does not match destination language ${destination.language}.`, `Provide a rendition in destination language ${destination.language}.`);
  const decision = reasons.some((reason) => reason.severity === 'block') ? 'block'
    : reasons.some((reason) => reason.code === 'AUTOMATION_NOT_ALLOWED') ? 'assist'
      : reasons.some((reason) => reason.code === 'DEST_RULE_FREQUENCY_CAP') ? 'reschedule' : 'allow';
  return { decision, reasons, next_allowed_at, rendition: result };
}
module.exports = { evaluate };
