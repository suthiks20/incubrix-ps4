/**
 * Stores small evidence objects beneath a configured local directory.
 * It rejects traversal keys so callers cannot escape the evidence root.
 */
import fs from 'fs/promises';
import path from 'path';

export interface Storage {
  put(key: string, value: string | Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  list(prefix?: string): Promise<string[]>;
  ready(): Promise<void>;
}

function safe(key: string): string {
  if (key.includes('..') || key.startsWith('/')) throw new Error('Unsafe storage key');
  return key;
}

function createLocal(root: string): Storage {
  const file = (key: string): string => path.join(root, safe(key));
  return {
    async put(key: string, value: string | Buffer): Promise<void> {
      const target = file(key);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, value);
    },
    get: (key: string): Promise<Buffer> => fs.readFile(file(key)),
    async exists(key: string): Promise<boolean> {
      try {
        await fs.access(file(key));
        return true;
      } catch {
        return false;
      }
    },
    async list(prefix = ''): Promise<string[]> {
      const output: string[] = [];
      async function walk(directory: string, relative = ''): Promise<void> {
        const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          const next = path.join(relative, entry.name);
          if (entry.isDirectory()) await walk(path.join(directory, entry.name), next);
          else if (next.startsWith(prefix)) output.push(next.replace(/\\/g, '/'));
        }
      }
      await walk(root);
      return output;
    },
    async ready(): Promise<void> { await fs.mkdir(root, { recursive: true }); }
  };
}

export { createLocal };
