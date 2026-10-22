/**
 * Normalizes the stable destination identity shared by rules and the ledger.
 * Keeping it here prevents dry runs and publishes from using different keys.
 */
import type { Destination } from '../types';

function destinationRef(destination: Partial<Destination> = {}): string {
  const value = destination.config && destination.config.base_url || destination.base_url || destination.url || '';
  return String(value).replace(/\/+$/, '').toLowerCase();
}

export { destinationRef };
