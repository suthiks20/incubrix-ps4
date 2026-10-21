/**
 * Exposes the connector implementations available to the API.
 * A small registry keeps route dispatch independent from connector loading.
 */
const discourse = require('./discourse');
module.exports = new Map([['discourse', discourse]]);
