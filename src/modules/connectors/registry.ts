/**
 * Exposes the connector implementations available to the API.
 * A small registry keeps route dispatch independent from connector loading.
 */
import * as discourse from './discourse';
import * as webhook from './webhook';
import * as assisted from './assisted';

const registry = new Map<string, any>([
  ['discourse', discourse],
  ['webhook', webhook],
  ['assisted', assisted]
]);

export = registry;
