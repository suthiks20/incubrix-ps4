/**
 * Defines pure certification step and tier constants shared by services.
 * Keeping these values central makes the certification flow easy to audit.
 */
const STEP_NAMES = Object.freeze([
  'validate', 'publish', 'confirm_live', 'read_status', 'delete', 'verify_gone', 'cleanup'
]);
function levelFor(tier) {
  if (tier === 'assisted') return 'L1';
  if (tier === 'feed' || tier === 'bridge') return 'L2';
  if (tier === 'native' || tier === 'protocol') return 'L3';
  return 'L0';
}
const ALLOWED_RUN_FILTERS = Object.freeze(['destination_id', 'status', 'limit', 'offset']);
module.exports = { STEP_NAMES, levelFor, ALLOWED_RUN_FILTERS };
