/**
 * Copies source YAML assets into the compiled tree after TypeScript emits JavaScript.
 * Connector manifests stay beside their compiled modules so runtime loading is unchanged.
 */
const fs = require('fs');
const path = require('path');

const sourceRoot = path.join(__dirname, '..', 'src');
const outputRoot = path.join(__dirname, '..', 'dist', 'src');

function copyYamlFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const sourcePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      copyYamlFiles(sourcePath);
      continue;
    }
    if (!entry.isFile() || !/\.yaml$/i.test(entry.name)) {
      continue;
    }
    const relativePath = path.relative(sourceRoot, sourcePath);
    const outputPath = path.join(outputRoot, relativePath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.copyFileSync(sourcePath, outputPath);
  }
}

copyYamlFiles(sourceRoot);
