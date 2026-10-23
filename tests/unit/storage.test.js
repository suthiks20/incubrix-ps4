/**
 * Covers the credential-free mock storage adapter used by test environments.
 * The same object port is shared by job outputs and certification evidence.
 */
const { createStorage } = require('../../src/shared/storage');

test('mock storage saves, lists, reads and reports ready without keys', async () => {
  const storage = createStorage({ STORAGE_DRIVER: 'mock', STORAGE_DIR: 'ignored' });
  await storage.put('jobs/one/output.json', '{"ok":true}');
  await expect(storage.exists('jobs/one/output.json')).resolves.toBe(true);
  await expect(storage.get('jobs/one/output.json')).resolves.toEqual(Buffer.from('{"ok":true}'));
  await expect(storage.list('jobs/')).resolves.toEqual(['jobs/one/output.json']);
  await expect(storage.ready()).resolves.toBeUndefined();
});
