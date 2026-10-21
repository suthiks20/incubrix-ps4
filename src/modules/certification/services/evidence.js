/**
 * Builds and stores the certification evidence file for one run, passed or failed.
 * Recursive stripping keeps connection credentials out of the file even in nested platform data.
 */
const SECRET_KEYS = new Set([
  'api_key', 'api_username', 'signing_secret', 'token', 'secret', 'password', 'connection'
]);

function strip(value) {
  if (Array.isArray(value)) return value.map(strip);
  if (!value || typeof value !== 'object') return value;
  const kept = Object.entries(value).filter(([key]) => !SECRET_KEYS.has(key));
  return Object.fromEntries(kept.map(([key, entry]) => [key, strip(entry)]));
}

function buildEvidence(run, destination, connector, steps) {
  return strip({
    ...run,
    destination: {
      name: destination.name,
      url: destination.url,
      connector_key: destination.connector_key,
      platform_key: destination.platform_key
    },
    connector: { key: connector.key, version: connector.version },
    steps
  });
}

async function storeEvidence(storage, result, manifest, failure) {
  const post = result.post;
  const run = {
    run_id: result.runId,
    platform_post_id: post ? post.platform_post_id : null,
    live_url: post ? post.live_url : null,
    deletion_confirmed: result.deleted,
    verdict: failure ? 'failed' : 'passed',
    failure: failure ? { code: failure.code || 'INTERNAL_ERROR', message: failure.message } : undefined,
    totals: { duration_ms: result.finishedAt - result.startedAt }
  };
  const evidence = buildEvidence(run, result.destination, manifest, result.steps);
  await storage.put(result.evidenceKey, JSON.stringify(evidence, null, 2), 'application/json');
}

module.exports = { buildEvidence, storeEvidence };
