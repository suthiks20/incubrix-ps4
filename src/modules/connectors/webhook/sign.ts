/**
 * Creates the partner webhook signature from the exact outgoing request body.
 * A small shared helper lets the connector and mock verify the same protocol.
 */
import crypto from 'crypto';

function sign(secret: string, timestamp: string, rawBody: string = ''): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
}

export { sign };
