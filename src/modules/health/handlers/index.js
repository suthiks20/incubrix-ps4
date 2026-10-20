/**
 * Exposes health handlers through one stable module entry point.
 * Routes import this barrel instead of reaching into sibling files.
 */
module.exports = { healthHandler: require('./health'), readyHandler: require('./ready') };
