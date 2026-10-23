/**
 * Builds the reproducibility record stored beside every durable job result.
 * Values are deterministic for mock-backed jobs and safe to return to clients.
 */
function buildOutputManifest(config: any, startedAt: number, warnings: string[] = []): any {
  return {
    providers: [{ name: 'incubrix', model: 'deterministic-mock', version: '1.0.0' }],
    settings: { storage_driver: config.STORAGE_DRIVER, simulation_mode: config.SIMULATION_MODE },
    seed: 'deterministic',
    timings: { total_ms: Date.now() - startedAt },
    cost_estimate: { currency: 'USD', amount: 0 },
    warnings,
    licence_rights: { input: 'caller supplied or public URL', output: 'assessment-only generated metadata', ai_generated: false }
  };
}

export { buildOutputManifest };
