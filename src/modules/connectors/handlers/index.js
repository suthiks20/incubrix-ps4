/**
 * Exports connector HTTP handlers through one stable module entry point.
 * Routes use this barrel so endpoint wiring stays small and obvious.
 */
module.exports = { contract: require('./contract') };
