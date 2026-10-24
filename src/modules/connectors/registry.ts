/**
 * Exposes the connector implementations available to the API.
 * A small registry keeps route dispatch independent from connector loading.
 */
import * as discourse from './discourse';
import * as devto from './devto';
import * as lemmy from './lemmy';
import * as ghost from './ghost';
import * as mrss from './mrss';
import * as slack from './slack';
import * as hashnode from './hashnode';
import * as webhook from './webhook';
import * as assisted from './assisted';

const registry = new Map<string, any>([
  ['discourse', discourse],
  ['devto', devto],
  ['lemmy', lemmy],
  ['ghost', ghost],
  ['mrss', mrss],
  ['slack', slack],
  ['hashnode', hashnode],
  ['webhook', webhook],
  ['assisted', assisted]
]);

export = registry;
