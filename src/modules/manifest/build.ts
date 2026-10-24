/**
 * Builds the reproducibility record stored beside every durable job result.
 * Values are deterministic for mock-backed jobs and safe to return to clients.
 */
function buildOutputManifest(config: any, startedAt: number, warnings: string[] = [], context: any = {}): any {
  const finishedAt = new Date();
  const startedAtDate = new Date(startedAt);
  const durationMs = Math.max(0, finishedAt.getTime() - startedAtDate.getTime());
  const connectorKey = context.connector_key || context.type || 'unknown';
  const storageDriver = config?.STORAGE_DRIVER || 'mock';
  const llmAdapter = context.llm_adapter || 'mock';
  const version = context.version || '1.0.0';

  return {
    providers: [
      { kind: 'connector', key: connectorKey, version },
      { kind: 'storage', key: storageDriver, version: 'native' },
      { kind: 'llm', key: llmAdapter, version: 'mock' }
    ],
    settings: {
      storage_driver: storageDriver,
      simulation_mode: Boolean(config?.SIMULATION_MODE),
      api_token_set: Boolean(config?.API_TOKEN),
      rate_limit_per_minute: Number(config?.RATE_LIMIT_PER_MINUTE || 0),
      connector_http_timeout_ms: Number(config?.CONNECTOR_HTTP_TIMEOUT_MS || 0)
    },
    seed: context.seed || 'deterministic',
    started_at: startedAtDate.toISOString(),
    finished_at: finishedAt.toISOString(),
    timings: {
      started_at: startedAtDate.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: durationMs
    },
    cost_estimate: { currency: 'USD', amount: 0 },
    warnings: Array.isArray(warnings) ? warnings : [],
    licence_rights: {
      input: 'caller supplied or public URL',
      output: 'assessment-only generated metadata',
      ai_generated: false,
      licence: 'assessment-only',
      usage: 'internal evaluation and certification only'
    },
    ai_generated: false
  };
}

export { buildOutputManifest };
