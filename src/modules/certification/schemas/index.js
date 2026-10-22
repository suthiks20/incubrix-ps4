/**
 * Exports one certification HTTP schema per endpoint through a small barrel.
 * Routes stay declarative and do not duplicate validation definitions.
 */
module.exports = {
  certify: require('./certify'),
  runs: require('./runs'),
  run: require('./run'),
  evidence: require('./evidence'),
  alerts: require('./alerts'),
  acknowledgeAlert: require('./acknowledgeAlert')
};
