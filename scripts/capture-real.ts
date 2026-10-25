/**
 * Runs one configured live rules capture and writes secret-free pending evidence.
 * The mock provider is not accepted as real-provider evidence.
 */
import fs = require('node:fs');
import path = require('node:path');
import config = require('../src/config');
import llm = require('../src/llm');

async function captureReal(): Promise<void> {
  const provider = config.LLM_PROVIDER.toLowerCase();
  const key = provider === 'gemini' ? config.GEMINI_API_KEY
    : provider === 'groq' ? config.GROQ_API_KEY
      : '';
  if (provider === 'mock') {
    throw new Error('Set LLM_PROVIDER to gemini, groq, or ollama for a live capture');
  }
  if (provider !== 'ollama' && !key) {
    throw new Error(`Set the API key for the configured ${provider} provider`);
  }
  const result = await llm.captureRules(provider, {
    rules_text: 'This community requires English posts, allows one link, and requires AI disclosure.'
  }, { config });
  const evidence = {
    provider: result.provider,
    model: result.model,
    latency_ms: result.latency_ms,
    proposal: { rules: result.rules, evidence: result.evidence },
    status: 'PENDING'
  };
  const output = JSON.stringify(evidence, null, 2);
  if (key && output.includes(key)) throw new Error('Provider key was present in capture output');
  const destination = path.resolve(process.cwd(), 'evidence/rules-capture-real.json');
  fs.writeFileSync(destination, `${output}\n`, { encoding: 'utf8', flag: 'wx' });
  process.stdout.write(`Saved pending rules-capture evidence for provider ${provider}.\n`);
}

captureReal().catch((error: Error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
