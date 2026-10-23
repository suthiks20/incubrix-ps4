/**
 * Selects the minimal evidence storage interface from the runtime configuration.
 * Future drivers can implement the same put/get/exists/list operations.
 */
import { createLocal, Storage } from './local';
import { createMock } from './mock';
import { createS3 } from './s3';

interface StorageConfig {
  STORAGE_DRIVER: string;
  STORAGE_DIR: string;
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY?: string;
  S3_SECRET_KEY?: string;
}

function createStorage(config: StorageConfig): Storage {
  if (config.STORAGE_DRIVER === 'local') return createLocal(config.STORAGE_DIR);
  if (config.STORAGE_DRIVER === 'mock') return createMock();
  if (config.STORAGE_DRIVER === 's3') return createS3(config);
  throw new Error('Unsupported storage driver');
}

export { createStorage };
