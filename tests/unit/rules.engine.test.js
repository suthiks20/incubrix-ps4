/**
 * Exercises policy fixtures and purity guarantees for the deterministic engine.
 * Fixture coverage makes every safety decision easy to inspect and extend.
 */
const cases = require('../fixtures/rule-cases.json');
const { evaluate } = require('../../src/modules/rules/engine');

test.each(cases)('$name', ({ input, expect: expected }) => {
  const result = evaluate(input);
  expect(result.decision).toBe(expected.decision);
  expect(result.reasons.map((reason) => reason.code)).toEqual(expect.arrayContaining(expected.codes));
});
test('rule cases: 24, caught: 24, missed: 0', () => {
  const missed = cases.filter(({ input, expect: expected }) => expected.decision !== 'allow' && evaluate(input).decision === 'allow');
  expect(`rule cases: ${cases.length}, caught: ${cases.length - missed.length}, missed: ${missed.length}`).toBe('rule cases: 24, caught: 24, missed: 0');
});
test('does not mutate inputs and requires a valid clock', () => {
  const input = { rendition: { title: 'x', body: 'x', links: ['https://a.test'], ai_generated: true }, destination: { disclosure_required: true }, history: { published_at: [] }, now: '2026-10-22T00:00:00.000Z' };
  const before = JSON.stringify(input); evaluate(input); expect(JSON.stringify(input)).toBe(before);
  expect(() => evaluate({ rendition: {}, destination: {} })).toThrow(TypeError);
});
