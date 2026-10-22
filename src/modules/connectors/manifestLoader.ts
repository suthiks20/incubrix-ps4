/**
 * Loads connector YAML manifests and rejects incomplete or unsafe mappings.
 * Startup validation keeps connector mistakes from surfacing during publishing.
 */
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import errorCodes = require('../../shared/errors/codes');
import type { Manifest } from './types';

function validateManifest(manifest: any): Manifest {
  const required = ['key', 'version', 'tier', 'auth', 'surfaces', 'rate_limits', 'capabilities', 'error_map', 'instance_param'];
  const missing = required.filter((name) => manifest[name] === undefined);
  if (missing.length) throw new Error(`Connector manifest missing required keys: ${missing.join(', ')}`);
  if (!Array.isArray(manifest.surfaces) || !manifest.surfaces.length || manifest.surfaces.some((surface) => !surface.key || !surface.spec)) throw new Error('Connector manifest surfaces must be a non-empty list of keyed specs');
  if (!manifest.rate_limits.per_connection) throw new Error('Connector manifest rate_limits.per_connection is required');
  for (const [status, code] of Object.entries(manifest.error_map)) {
    if (!errorCodes[code as string]) {
      throw new Error(`Connector manifest error_map ${status} uses unknown error code ${code}`);
    }
  }
  return manifest;
}

function loadManifest(filePath: string): Manifest {
  return validateManifest(yaml.load(fs.readFileSync(filePath, 'utf8')));
}

function loadManifests(directory = __dirname): Manifest[] {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(directory, entry.name, 'manifest.yaml')))
    .map((entry) => loadManifest(path.join(directory, entry.name, 'manifest.yaml')));
}

export { validateManifest, loadManifest, loadManifests };
