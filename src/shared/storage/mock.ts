/**
 * Provides an in-memory storage adapter for deterministic tests and demos.
 * It accepts the same operations as persistent storage without credentials.
 */
import type { Storage } from './local';

function createMock(): Storage {
  const objects = new Map<string, Buffer>();
  return {
    async put(key, value) { objects.set(key, Buffer.from(value)); },
    async get(key) {
      const value = objects.get(key);
      if (!value) throw new Error('Storage object not found');
      return value;
    },
    async exists(key) { return objects.has(key); },
    async list(prefix = '') { return [...objects.keys()].filter((key) => key.startsWith(prefix)); },
    async ready() { return undefined; }
  };
}

export { createMock };
