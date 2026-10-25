/**
 * Extracts only policy statements supported by supplied page text.
 * Unmentioned policy fields remain null for human review.
 */
function emptyRules(): Record<string, any> {
  return {
    self_promo_allowed: null,
    link_policy: null,
    frequency_cap: null,
    disclosure_required: null,
    language: null
  };
}

function extractFrequency(text: string): { posts: number; per_days: number } | null {
  const match = text.match(/(\d+)\s+posts?\s+(?:per|every)\s+(\d+)\s+days?/i);
  if (match) return { posts: Number(match[1]), per_days: Number(match[2]) };
  if (/one post per week|1 post per week|weekly cap/i.test(text)) {
    return { posts: 1, per_days: 7 };
  }
  return null;
}

function extractEvidence(text: string): string[] {
  return text.split(/[\r\n.!?]+/).map((line) => line.trim()).filter(Boolean).slice(0, 5)
    .map((line) => line.slice(0, 240));
}

function parseCaptureRules(text: string): { rules: Record<string, any>; evidence: string[] } {
  const source = String(text || '');
  const lower = source.toLowerCase();
  const rules = emptyRules();
  if (/no promotional content|no self[- ]promotion|no self[- ]promo/.test(lower)) {
    rules.self_promo_allowed = false;
  } else if (/self[- ]promotion is allowed|promotional content is allowed/.test(lower)) {
    rules.self_promo_allowed = true;
  }
  if (/no links|links are not allowed/.test(lower)) rules.link_policy = 'no_links';
  else if (/one link only|max(?:imum)? one link/.test(lower)) rules.link_policy = 'max_one_link';
  else if (/links are allowed|links permitted/.test(lower)) rules.link_policy = 'allowed';
  rules.frequency_cap = extractFrequency(source);
  if (/ai disclosure required|must disclose ai|disclose ai use/.test(lower)) {
    rules.disclosure_required = true;
  } else if (/ai disclosure (?:is )?not required|no ai disclosure/.test(lower)) {
    rules.disclosure_required = false;
  }
  const language = source.match(/language\s*:\s*([a-z]{2,3}(?:-[a-z0-9]{2,8})?)/i);
  if (language) rules.language = language[1].toLowerCase();
  else if (/english only/i.test(source)) rules.language = 'en';
  return { rules, evidence: extractEvidence(source) };
}

function makeProposal(parsed: { rules: Record<string, any>; evidence: string[] }): any {
  return {
    id: `rules-proposal-${Date.now()}`,
    status: 'PENDING',
    provider: 'mock',
    model: 'deterministic-mock',
    latency_ms: 0,
    rules: parsed.rules,
    evidence: parsed.evidence,
    created_at: new Date().toISOString()
  };
}

function confirmRulesProposal(proposal: any): any {
  if (!proposal) throw new Error('Proposal is required');
  return { ...proposal, status: 'CONFIRMED', confirmed_at: new Date().toISOString() };
}

export { parseCaptureRules, makeProposal, confirmRulesProposal };
