/**
 * Verifies certification tier level mapping stays stable and explicit.
 * Unknown tiers deliberately remain at the unearned L0 level.
 */
const { levelFor } = require('../../src/modules/certification/commons/constants');
test.each([['assisted', 'L1'], ['feed', 'L2'], ['bridge', 'L2'], ['native', 'L3'], ['protocol', 'L3'], ['other', 'L0']])('maps %s to %s', (tier, level) => expect(levelFor(tier)).toBe(level));
