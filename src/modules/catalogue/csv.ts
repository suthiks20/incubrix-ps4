/**
 * Parses catalogue CSV and formats row-level reports without external packages.
 * Header checks prevent secret-bearing columns from entering persisted job input.
 */
const ALLOWED_HEADERS = new Set([
  'name', 'url', 'platform_key', 'connector_key', 'surface', 'category',
  'description', 'audience_tags', 'language', 'geo', 'est_audience', 'rules_url',
  'frequency_cap', 'self_promo_allowed', 'link_policy', 'disclosure_required',
  'automation_allowed'
]);

function parseCsv(source: string): string[][] {
  const text = source.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && character === ',') {
      row.push(field);
      field = '';
    } else if (!quoted && (character === '\n' || character === '\r')) {
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = '';
      if (character === '\r' && text[index + 1] === '\n') index += 1;
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field');
  row.push(field);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function parseRecords(source: string): Record<string, string>[] {
  const rows = parseCsv(source);
  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  if (new Set(headers).size !== headers.length || headers.some((header) => !header)) {
    throw new Error('CSV headers must be unique and non-empty');
  }
  assertSafeHeaders(headers);
  return rows.slice(1).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, String(values[index] || '').trim()])
  ));
}

function assertSafeHeaders(headers: string[]): void {
  const unsafe = headers.filter((header) => !ALLOWED_HEADERS.has(header));
  if (unsafe.length) throw new Error(`Unsupported CSV columns: ${unsafe.join(', ')}`);
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatErrorCsv(rows: Array<Record<string, unknown>>): string {
  const headers = ['row', 'name', 'url', 'platform_key', 'code', 'message'];
  return [headers.join(','), ...rows.map((row) => headers.map((key) => escapeCsv(row[key])).join(','))]
    .join('\r\n') + '\r\n';
}

export { parseCsv, parseRecords, assertSafeHeaders, formatErrorCsv };
