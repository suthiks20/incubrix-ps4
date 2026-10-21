/**
 * Exercises the pure recorder with a manually advancing injected clock.
 * These tests make recorded durations independent of wall-clock timing.
 */
const { createRecorder } = require('../../src/modules/certification/services/steps');
test('records pass duration and summary', async () => { let time = 0; const r = createRecorder(() => new Date(time += 5)); await r.run('validate', async () => ({ summary: 'valid' })); expect(r.steps()[0]).toMatchObject({ status: 'passed', duration_ms: 5, summary: 'valid' }); });
test('records failures and rethrows', async () => { const r = createRecorder(() => new Date(0)); const error = Object.assign(new Error('bad'), { code: 'SCHEMA_DRIFT' }); await expect(r.run('publish', async () => { throw error; })).rejects.toBe(error); expect(r.steps()[0].error.code).toBe('SCHEMA_DRIFT'); });
test('skips remaining steps with failure reason', () => { const r = createRecorder(() => new Date(0)); r.skipRest('publish', ['confirm_live', 'delete']); expect(r.steps().map((step) => step.summary)).toEqual(['skipped: publish failed', 'skipped: publish failed']); });
