/**
 * Selects the rules-capture provider and keeps proposals pending.
 * Confirmation is explicit and separate from capture.
 */
import { parseCaptureRules, makeProposal, confirmRulesProposal } from './mock';
import { callProvider, providerError } from './providers';
import { fetchRulesPage } from './fetchRulesPage';

function getAdapter(provider: string = 'mock'): any {
  const selected = String(provider || 'mock').toLowerCase();
  if (!['mock', 'gemini', 'groq', 'ollama'].includes(selected)) {
    throw providerError();
  }
  return {
    captureRules: (input: any, options: any = {}) => captureRules(selected, input, options),
    confirmRulesProposal
  };
}

async function captureRules(provider: string, input: any, options: any = {}): Promise<any> {
  const started = Date.now();
  const text = input?.rules_text || (input?.url
    ? await fetchRulesPage(input.url, {
      fetcher: options.fetcher,
      timeoutMs: options.config?.LLM_TIMEOUT_MS
    })
    : '');
  if (provider === 'mock') {
    const parsed = parseCaptureRules(text);
    return {
      ...makeProposal(parsed),
      latency_ms: Date.now() - started,
      source: input?.url || 'inline'
    };
  }
  const parsed = await callProvider(provider, text, options);
  return {
    id: `rules-proposal-${Date.now()}`,
    status: 'PENDING',
    ...parsed,
    rules: {
      self_promo_allowed: parsed.self_promo_allowed,
      link_policy: parsed.link_policy,
      frequency_cap: parsed.frequency_cap,
      disclosure_required: parsed.disclosure_required,
      language: parsed.language
    },
    source: input?.url || 'inline',
    created_at: new Date().toISOString()
  };
}

export { captureRules, getAdapter, parseCaptureRules, confirmRulesProposal };
