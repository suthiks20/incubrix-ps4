/**
 * Selects the minimal evidence storage interface from the runtime configuration.
 * Future drivers can implement the same put/get/exists/list operations.
 */
import { createLocal, Storage } from './local';

interface StorageConfig {
  STORAGE_DRIVER: string;
  STORAGE_DIR: string;
}

function createStorage(config: StorageConfig): Storage {
  if (config.STORAGE_DRIVER !== 'local') throw new Error('Unsupported storage driver');
  return createLocal(config.STORAGE_DIR);
}

export { createStorage };
