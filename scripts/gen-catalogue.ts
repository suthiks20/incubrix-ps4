/**
 * Generates a deterministic 1,000-row catalogue fixture for import timing.
 * Rows include normalized duplicates, invalid URLs, and mixed-language text.
 */
import fs from 'fs';
import path from 'path';

const headers = [
  'name', 'url', 'platform_key', 'connector_key', 'category', 'description', 'audience_tags'
];

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function rowValues(index: number): string[] {
  const duplicate = index % 10 === 1;
  const rowIndex = duplicate ? index - 1 : index;
  const invalid = index % 50 === 2;
  const spanish = index % 3 === 0;
  const name = spanish ? `Comunidad ${rowIndex}` : `Community ${rowIndex}`;
  const description = spanish
    ? 'La comunidad comparte ideas y recursos para creadores.'
    : 'The community shares ideas and resources for creators.';
  const url = invalid
    ? `ftp://invalid.example/community/${rowIndex}`
    : `https://example.com/community/${rowIndex}${duplicate ? '/' : ''}`;
  return [name, url, 'forum', 'discourse', spanish ? 'creadores' : 'creators', description, 'creators'];
}

function main(): void {
  const output = path.resolve(process.argv[2] || 'samples/catalogue/catalogue-1000.csv');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const lines = [headers.join(',')];
  for (let index = 0; index < 1000; index += 1) {
    lines.push(rowValues(index).map(csvCell).join(','));
  }
  fs.writeFileSync(output, `${lines.join('\r\n')}\r\n`, 'utf8');
  process.stdout.write(`Generated ${lines.length - 1} catalogue rows at ${output}\n`);
}

main();
