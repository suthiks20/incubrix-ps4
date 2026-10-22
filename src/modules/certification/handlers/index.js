/**
 * Adapts certification HTTP requests to the certification services.
 * Routes stay declarative while these handlers build the dependencies each service needs.
 */
module.exports = {
  certify: require('./certify'),
  getRuns: require('./getRuns'),
  getRun: require('./getRun'),
  getEvidence: require('./getEvidence'),
  getAlerts: require('./getAlerts'),
  acknowledgeAlert: require('./acknowledgeAlert'),
  cleanup: require('./cleanup'),
  getSummary: require('./getSummary')
};
