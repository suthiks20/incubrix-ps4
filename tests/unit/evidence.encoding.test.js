/**
 * Ensures every checked-in evidence JSON file is valid UTF-8 JSON.
 * This prevents encoding problems from hiding malformed evidence.
 */
const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('node:util');

test('evidence json files are valid utf-8 json', () => {
  const evidenceDirectory = path.resolve(__dirname, '../../evidence');
  const files = fs.readdirSync(evidenceDirectory).filter((file) => file.endsWith('.json'));
  expect(files.length).toBeGreaterThan(0);

  for (const file of files) {
    const bytes = fs.readFileSync(path.join(evidenceDirectory, file));
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    expect(() => JSON.parse(text)).not.toThrow();
  }
});
