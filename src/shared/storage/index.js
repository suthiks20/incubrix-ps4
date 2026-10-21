/**
 * Selects the minimal evidence storage interface from the runtime configuration.
 * Future drivers can implement the same put/get/exists/list operations.
 */
const { createLocal } = require('./local');
function createStorage(config) { if (config.STORAGE_DRIVER !== 'local') throw new Error('Unsupported storage driver'); return createLocal(config.STORAGE_DIR); }
module.exports = { createStorage };
