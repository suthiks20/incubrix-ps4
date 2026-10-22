/**
 * Signs callback bytes with the shared HMAC scheme used by outbound jobs.
 * The function is pure so callbacks can be verified by tests without HTTP.
 */
import crypto from 'crypto';

function sign(secret: string, timestamp: string, body: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

export { sign };
