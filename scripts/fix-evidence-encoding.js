/**
 * Re-encodes the two self-test evidence records as UTF-8 without changing values.
 * The parsed JSON is compared before and after each file is written.
 */
const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('node:util');
const { isDeepStrictEqual } = require('util');

const evidenceDirectory = path.resolve(__dirname, '../evidence');
const files = ['selftest-result.json', 'selftest-render.json'];

function decodeJson(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString('utf16le', 2);
  }
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const bytes = Buffer.from(buffer.subarray(2));
    for (let index = 0; index + 1 < bytes.length; index += 2) {
      const first = bytes[index];
      bytes[index] = bytes[index + 1];
      bytes[index + 1] = first;
    }
    return bytes.toString('utf16le');
  }
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(3));
  }

  const evenNulls = buffer.filter((byte, index) => index % 2 === 0 && byte === 0).length;
  const oddNulls = buffer.filter((byte, index) => index % 2 === 1 && byte === 0).length;
  if (evenNulls + oddNulls > buffer.length / 8) {
    const littleEndian = oddNulls > evenNulls;
    const bytes = littleEndian ? buffer : Buffer.from(buffer);
    if (!littleEndian) {
      for (let index = 0; index + 1 < bytes.length; index += 2) {
        const first = bytes[index];
        bytes[index] = bytes[index + 1];
        bytes[index + 1] = first;
      }
    }
    return bytes.toString('utf16le');
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
}

for (const file of files) {
  const filePath = path.join(evidenceDirectory, file);
  const before = JSON.parse(decodeJson(fs.readFileSync(filePath)));
  fs.writeFileSync(filePath, `${JSON.stringify(before, null, 2)}\n`, 'utf8');
  const after = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(filePath)));
  if (!isDeepStrictEqual(before, after)) {
    throw new Error(`Parsed JSON changed while re-encoding ${file}`);
  }
  process.stdout.write(`Verified UTF-8 encoding and unchanged JSON: ${file}\n`);
}
