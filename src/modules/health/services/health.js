/**
 * Implements liveness without depending on any external system.
 * It reports process uptime so orchestration can observe a live process.
 */
const { SERVICE_NAME, SERVICE_VERSION } = require('../commons/constants');
function getHealth() {
  return { status: 'ok', service: SERVICE_NAME, version: SERVICE_VERSION, uptime_seconds: Math.floor(process.uptime()) };
}
module.exports = { getHealth };
