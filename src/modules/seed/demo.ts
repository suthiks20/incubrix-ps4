/**
 * Seeds a repeatable catalogue of simulation-only destinations.
 * Destination rows contain mock URLs and configuration, never credentials.
 */
import normalizeUrl = require('../destinations/commons/normalizeUrl');
import * as destinations from '../destinations/repository/destinations';

function destinationSpecs(mockRoot: string): any[] {
  const discourse = (scenario: string) => `${mockRoot}/discourse/${scenario}`;
  const specs: any[] = [
    { name: 'sim-timeout', connector: 'discourse', scenario: 'timeout_after_success' },
    { name: 'sim-429', connector: 'discourse', scenario: 'rate_limit' },
    { name: 'sim-expired-token', connector: 'discourse', scenario: 'expired_token' },
    { name: 'sim-content-rejected', connector: 'discourse', scenario: 'content_rejected' },
    { name: 'sim-renamed-field', connector: 'lemmy', scenario: 'renamed_field' },
    { name: 'sim-no-promo', connector: 'discourse', scenario: 'sim-no-promo', promo: false },
    {
      name: 'sim-weekly-cap',
      connector: 'discourse',
      scenario: 'sim-weekly-cap',
      frequencyCap: { posts: 1, per_days: 7 }
    },
    { name: 'sim-needs-disclosure', connector: 'discourse', scenario: 'sim-needs-disclosure', disclosure: true },
    { name: 'sim-revoked-partner', connector: 'webhook', scenario: 'partner_revoked' },
    { name: 'sim-non-english', connector: 'lemmy', scenario: 'sim-non-english', language: 'es' },
    { name: 'sim-media-rejected', connector: 'discourse', scenario: 'sim-media-rejected', media: [] }
  ];
  const healthy = ['discourse', 'lemmy', 'devto', 'ghost', 'webhook', 'assisted'];
  const connectorSpecs = healthy.map((connector) => ({
    name: `sim-healthy-${connector}`,
    connector,
    scenario: connector === 'assisted' ? 'sim-healthy-assisted' : 'normal',
    assisted: connector === 'assisted'
  }));
  return [...specs, ...connectorSpecs].map((spec) => {
    const base = spec.connector === 'webhook'
      ? `${mockRoot}/webhook/${spec.scenario}`
      : spec.connector === 'lemmy'
        ? `${mockRoot}/lemmy/${spec.scenario}`
        : spec.connector === 'devto'
          ? `${mockRoot}/devto/${spec.scenario}`
          : spec.connector === 'ghost'
            ? `${mockRoot}/ghost/${spec.scenario}`
            : discourse(spec.scenario);
    const surface = spec.connector === 'discourse' ? 'topic'
      : spec.connector === 'devto' ? 'article'
        : spec.connector === 'assisted' ? 'pack' : 'post';
    const row: any = {
      name: spec.name,
      url: `https://${spec.name}.sim.invalid`,
      url_normalized: normalizeUrl(`https://${spec.name}.sim.invalid`),
      platform_key: spec.connector,
      surface,
      category: null,
      audience_tags: JSON.stringify(['AI', 'creators']),
      language: spec.language || 'en',
      geo: null,
      est_audience: null,
      rules_url: null,
      frequency_cap: spec.frequencyCap ? JSON.stringify(spec.frequencyCap) : null,
      self_promo_allowed: spec.promo === undefined ? true : spec.promo,
      link_policy: 'allowed',
      disclosure_required: Boolean(spec.disclosure),
      automation_allowed: !spec.assisted,
      connector_key: spec.connector,
      config: JSON.stringify({
        base_url: base,
        simulation: true,
        community_name: 'incubrix_test',
        community: 'incubrix_test',
        ...(spec.media ? { media_types: spec.media } : {}),
        ...(spec.disclosure ? { disclosure_text: 'Disclosure: this post was created with AI assistance.' } : {})
      }),
      connection_ref: null,
      relevance_score: 3,
      relevance_reason: 'Seeded for local simulation coverage.',
      enabled: true
    };
    return row;
  });
}

async function seedDemoDestinations(knex: any, config: any, mockRoot: string): Promise<number> {
  if (!config.SIMULATION_MODE) return 0;
  const rows = destinationSpecs(mockRoot);
  for (const row of rows) {
    const existing = await destinations.findByPlatformAndUrl(
      knex,
      row.platform_key,
      row.url_normalized
    );
    if (existing) {
      await destinations.updateById(knex, existing.id, row);
    } else {
      await destinations.insert(knex, row);
    }
  }
  return rows.length;
}

export { seedDemoDestinations };
