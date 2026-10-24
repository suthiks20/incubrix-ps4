/**
 * Checks real local-platform certification artifacts when both runs have been recorded.
 * The test stays skipped in environments that have not bootstrapped local instances.
 */
const fs = require('fs');
const path = require('path');

const evidencePaths = ['lemmy', 'ghost'].map((key) =>
  path.resolve(process.cwd(), 'evidence', `cert-${key}-real.json`)
);
const evidenceExists = evidencePaths.every((filePath) => fs.existsSync(filePath));

(evidenceExists ? test : test.skip)('real certification evidence files show passed at L3', () => {
  for (const filePath of evidencePaths) {
    const evidence = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(evidence.status).toBe('passed');
    expect(evidence.level_awarded).toBe('L3');
    expect(evidence.test_post_deleted).toBe(true);
    expect(evidence.deletion_confirmation).toEqual(expect.objectContaining({ removed: true }));
    const statuses = new Map(evidence.steps.map((step) => [step.name, step.status]));
    for (const name of ['publish', 'confirm_live', 'read_status', 'delete', 'verify_gone']) {
      expect(statuses.get(name)).toBe('passed');
    }
  }
});
