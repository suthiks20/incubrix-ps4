/**
 * Loads connector YAML manifests and rejects incomplete or unsafe mappings.
 * Startup validation keeps connector mistakes from surfacing during publishing.
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const errorCodes = require('../../shared/errors/codes');

function validateManifest(manifest) {
  const required = ['key', 'version', 'tier', 'auth', 'surfaces', 'rate_limits', 'capabilities', 'error_map', 'instance_param'];
  const missing = required.filter((name) => manifest[name] === undefined);
  if (missing.length) throw new Error(`Connector manifest missing required keys: ${missing.join(', ')}`);
  for (const [status, code] of Object.entries(manifest.error_map)) {
    if (!errorCodes[code]) throw new Error(`Connector manifest error_map ${status} uses unknown error code ${code}`);
  }
  return manifest;
}

function loadManifest(filePath) {
  return validateManifest(yaml.load(fs.readFileSync(filePath, 'utf8')));
}

function loadManifests(directory = path.join(__dirname, 'discourse')) {
  return [loadManifest(path.join(directory, 'manifest.yaml'))];
}

module.exports = { validateManifest, loadManifest, loadManifests };
