/**
 * Stores small evidence objects beneath a configured local directory.
 * It rejects traversal keys so callers cannot escape the evidence root.
 */
const fs = require('fs/promises'); const path = require('path');
function safe(key) { if (key.includes('..') || key.startsWith('/')) throw new Error('Unsafe storage key'); return key; }
function createLocal(root) { const file = (key) => path.join(root, safe(key)); return { async put(key, value) { const target = file(key); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, value); }, get: (key) => fs.readFile(file(key)), async exists(key) { try { await fs.access(file(key)); return true; } catch { return false; } }, async list(prefix = '') { const output = []; async function walk(dir, rel = '') { for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) { const next = path.join(rel, entry.name); if (entry.isDirectory()) await walk(path.join(dir, entry.name), next); else if (next.startsWith(prefix)) output.push(next.replace(/\\/g, '/')); } } await walk(root); return output; } }; }
module.exports = { createLocal };
