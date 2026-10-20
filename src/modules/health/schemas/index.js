/**
 * Collects endpoint schemas so health routes stay concise and readable.
 * Later modules follow this same barrel-export convention.
 */
module.exports = { health: require('./health'), ready: require('./ready') };
