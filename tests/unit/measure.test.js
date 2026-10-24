/**
 * Validates the metrics calculations against the checked-in rule cases.
 * These tests keep evidence summaries tied to actual fixture outcomes.
 */
const fs = require('fs');
const path = require('path');
const { calculateCertificationMetrics, calculateRuleMetrics } = require('../../scripts/measure');

test('measurement catches every rule violation represented by the fixture', () => {
  const cases = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/rule-cases.json'), 'utf8'));
  const metrics = calculateRuleMetrics(cases);
  expect(metrics.cases).toBeGreaterThanOrEqual(20);
  expect(metrics.violations_missed).toBe(0);
  expect(metrics.by_rule.frequency_cap.expected).toBeGreaterThan(0);
  expect(metrics.by_rule.no_promo.expected).toBeGreaterThan(0);
  expect(metrics.by_rule.link_policy.expected).toBeGreaterThan(0);
  expect(metrics.by_rule.ai_disclosure.expected).toBeGreaterThan(0);
});

test('certification metrics count only supplied preserved real run records', () => {
  const metrics = calculateCertificationMetrics([
    { connector_key: 'lemmy', status: 'passed', duration_ms: 785 }
  ]);
  expect(metrics.total_real_runs).toBe(1);
  expect(metrics.per_connector.lemmy).toEqual({ real_runs: 1, passed: 1, time_per_run_ms: [785] });
  expect(metrics.per_connector.ghost.real_runs).toBe(0);
});
