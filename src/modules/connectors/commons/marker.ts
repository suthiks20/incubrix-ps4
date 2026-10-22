/**
 * Builds opaque, stable markers from idempotency keys for remote post recovery.
 * A marker identifies a post without exposing the client-supplied key publicly.
 */
import crypto from 'crypto';

function markerFor(idempotencyKey: string): string {
  return crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16);
}

export { markerFor };
