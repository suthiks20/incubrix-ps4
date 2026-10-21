/**
 * Creates the partner webhook signature from the exact outgoing request body.
 * A small shared helper lets the connector and mock verify the same protocol.
 */
const crypto = require('crypto');

function sign(secret, timestamp, rawBody = '') {
  return `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
}

module.exports = { sign };
