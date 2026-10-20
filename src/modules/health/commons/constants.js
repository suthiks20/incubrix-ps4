/**
 * Holds health-module identity values separate from route implementation.
 * The version is read from package metadata, not duplicated in source.
 */
const packageInfo = require('../../../../package.json');
module.exports = { SERVICE_NAME: 'incubrix-longtail', SERVICE_VERSION: packageInfo.version };
