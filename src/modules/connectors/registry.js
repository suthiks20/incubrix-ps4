/**
 * Exposes the connector implementations available to the API.
 * A small registry keeps route dispatch independent from connector loading.
 */
const discourse = require('./discourse');
const webhook = require('./webhook');
const assisted = require('./assisted');
module.exports = new Map([['discourse', discourse], ['webhook', webhook], ['assisted', assisted]]);
