/**
 * Exports the connector contract schemas from one module entry point.
 * Route registration imports this barrel to keep endpoint wiring consistent.
 */
module.exports = { contract: require('./contract') };
