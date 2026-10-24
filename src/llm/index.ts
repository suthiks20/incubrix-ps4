/**
 * Provides a small adapter layer for rule-capture providers.
 * The mock provider is deterministic so tests can run without keys.
 */

const DEFAULT_RULES = {
  self_promo_allowed: false,
  disclosure_required: true,
  frequency_cap: { posts: 1, per_days: 7 },
  language: 'en',
  link_policy: 'max_one_link'
};

function parseCaptureRules(text: string): any {
  const source = String(text || '').toLowerCase();
  const findings: any = { ...DEFAULT_RULES };
  if (/no\s+promotional|no\s+promo|no\s+self[- ]?promo/.test(source)) {
    findings.self_promo_allowed = false;
  }
  if (/must\s+disclose|ai\s+disclosure|disclose\s+ai/.test(source)) {
    findings.disclosure_required = true;
  }
  if (/one\s+post\s+per\s+week|weekly\s+cap|7\s+day/.test(source)) {
    findings.frequency_cap = { posts: 1, per_days: 7 };
  }
  if (/english\s+only|language\s*:\s*en/.test(source)) {
    findings.language = 'en';
  }
  if (/max\s+one\s+link|one\s+link\s+only/.test(source)) {
    findings.link_policy = 'max_one_link';
  }
  return findings;
}

async function fetchRulesText(source: any, fetcher?: any): Promise<string> {
  if (source && typeof source === 'string') return source;
  if (!source) return '';
  if (typeof fetcher === 'function') return String(await fetcher(source));
  if (typeof source === 'object' && typeof source.text === 'string') return source.text;
  if (typeof source === 'object' && typeof source.body === 'string') return source.body;
  return '';
}

async function captureRules(input: any, fetcher?: any): Promise<any> {
  const pageText = await fetchRulesText(input?.rules_text || input?.url || input, fetcher);
  const rules = parseCaptureRules(pageText);
  return {
    id: `rules-proposal-${Date.now()}`,
    status: 'PENDING',
    provider: 'mock',
    rules,
    created_at: new Date().toISOString(),
    source: input?.url || 'inline'
  };
}

function confirmRulesProposal(proposal: any): any {
  if (!proposal) throw new Error('Proposal is required');
  return {
    ...proposal,
    status: 'CONFIRMED',
    confirmed_at: new Date().toISOString(),
    rules: proposal.rules || {}
  };
}

const adapters = {
  mock: { captureRules, confirmRulesProposal },
  gemini: { captureRules, confirmRulesProposal },
  groq: { captureRules, confirmRulesProposal },
  ollama: { captureRules, confirmRulesProposal }
};

function getAdapter(provider: string = 'mock') {
  return adapters[String(provider || 'mock').toLowerCase()] || adapters.mock;
}

export = { captureRules, confirmRulesProposal, getAdapter, parseCaptureRules };
