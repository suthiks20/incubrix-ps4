/**
 * Records deterministic certification steps using an injected clock.
 * It has no database or network dependency, so service tests can control time.
 */
function createRecorder(now) {
  const recorded = [];

  async function run(name, fn) {
    const started = now();
    try {
      const result = await fn();
      recorded.push({
        name,
        status: 'passed',
        started_at: started.toISOString(),
        duration_ms: now() - started,
        summary: result.summary
      });
      return result;
    } catch (error) {
      recorded.push({
        name,
        status: 'failed',
        started_at: started.toISOString(),
        duration_ms: now() - started,
        summary: error.message,
        error: { code: error.code || 'INTERNAL_ERROR', message: error.message }
      });
      throw error;
    }
  }

  function skip(name, summary) {
    recorded.push({
      name,
      status: 'skipped',
      started_at: now().toISOString(),
      duration_ms: 0,
      summary
    });
  }

  function skipRest(afterName, names) {
    names.forEach((name) => skip(name, `skipped: ${afterName} failed`));
  }

  function steps() {
    return recorded.slice();
  }

  return { run, skip, skipRest, steps };
}

module.exports = { createRecorder };
