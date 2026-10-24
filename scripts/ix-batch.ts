/**
 * Runs a batch of job payloads against the public API and stores the results.
 * The CLI keeps the output folder self-contained and creates one summary JSON.
 */
const fs = require('fs/promises');
const path = require('path');

async function readJsonFile(filePath: string): Promise<any> {
  const text = await fs.readFile(filePath, 'utf8');
  return JSON.parse(text);
}

async function listInputs(input: string): Promise<string[]> {
  const stat = await fs.stat(input).catch(() => null);
  if (stat && stat.isFile()) return [input];
  const entries = await fs.readdir(input, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(input, entry.name))
    .sort();
}

function payloadFor(entry: any): any {
  if (entry && typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, 'type') && Object.prototype.hasOwnProperty.call(entry, 'input')) {
    return entry;
  }
  return { type: 'certify', input: entry };
}

async function fetchJson(url: string, init?: any): Promise<any> {
  const response = await fetch(url, init);
  const text = await response.text();
  try { return { status: response.status, headers: Object.fromEntries(response.headers.entries()), body: JSON.parse(text) }; }
  catch { return { status: response.status, headers: Object.fromEntries(response.headers.entries()), body: text }; }
}

function requestHeaders(token?: string): Record<string, string> {
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function pollJob(api: string, jobId: string, token?: string): Promise<any> {
  const maxAttempts = 60;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetchJson(`${api}/api/v1/jobs/${jobId}`, { headers: requestHeaders(token) });
    const payload = response.body;
    if (payload && (payload.status === 'succeeded' || payload.status === 'failed')) return payload;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for job ${jobId}`);
}

async function download(api: string, url: string, filePath: string, token?: string): Promise<void> {
  const absoluteUrl = new URL(url, api).toString();
  const response = await fetch(absoluteUrl, { headers: requestHeaders(token) });
  if (!response.ok) throw new Error(`Download failed: ${url} -> ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
}

async function runBatch(options: any = {}): Promise<any> {
  const api = options.api || 'http://localhost:8000';
  const input = options.input || 'samples/batch';
  const out = options.out || 'batch-out';
  const token = options.token;
  const files = await listInputs(input);
  const summary: any = { total: files.length, passed: 0, failed: 0, duration_ms: [], results: [] };
  await fs.mkdir(out, { recursive: true });

  for (let index = 0; index < files.length; index += 1) {
    const filePath = files[index];
    const payload = payloadFor(await readJsonFile(filePath));
    const startedAt = Date.now();
    const response = await fetchJson(`${api}/api/v1/jobs`, {
      method: 'POST',
      headers: {
        ...requestHeaders(token),
        'content-type': 'application/json',
        'idempotency-key': `ix-batch-${Date.now()}-${index}`
      },
      body: JSON.stringify(payload)
    });

    if (response.status !== 202) {
      const duration = Date.now() - startedAt;
      const resultFile = path.join(out, `${String(index + 1).padStart(3, '0')}-${path.basename(filePath, path.extname(filePath))}.json`);
      const result = {
        file: path.basename(filePath),
        status: 'failed',
        passed: false,
        reason: response.body,
        duration_ms: duration,
        output_path: resultFile
      };
      await fs.writeFile(resultFile, JSON.stringify(result, null, 2));
      summary.failed += 1;
      summary.duration_ms.push(duration);
      summary.results.push(result);
      continue;
    }

    const job = response.body;
    const reading = await pollJob(api, job.job_id, token);
    const duration = Date.now() - startedAt;
    const resultFile = path.join(out, `${String(index + 1).padStart(3, '0')}-${path.basename(filePath, path.extname(filePath))}.json`);
    await fs.writeFile(resultFile, JSON.stringify(reading, null, 2));

    if (reading.links && reading.links.manifest) {
      const manifestPath = path.join(out, `${String(index + 1).padStart(3, '0')}-${path.basename(filePath, path.extname(filePath))}-manifest.json`);
      await download(api, reading.links.manifest, manifestPath, token);
      reading.manifest_path = manifestPath;
    }
    if (reading.links && reading.links.report) {
      const reportPath = path.join(out, `${String(index + 1).padStart(3, '0')}-${path.basename(filePath, path.extname(filePath))}-report.json`);
      await download(api, reading.links.report, reportPath, token);
      reading.report_path = reportPath;
    }
    if (reading.manifest_path || reading.report_path) {
      await fs.writeFile(resultFile, JSON.stringify(reading, null, 2));
    }

    const batchItems = reading.type === 'batch_publish' ? reading.result?.items : null;
    const passed = reading.status === 'succeeded' &&
      (!batchItems || batchItems.length > 0 && batchItems.every((item: any) => item.passed));
    summary.results.push({
      file: path.basename(filePath),
      job_id: job.job_id,
      status: reading.status,
      passed,
      duration_ms: duration,
      output_path: resultFile
    });

    if (passed) summary.passed += 1; else summary.failed += 1;
    summary.duration_ms.push(duration);
  }

  await fs.writeFile(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const values: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if ((current === '--input' || current === '--out' || current === '--api' || current === '--token') && args[index + 1]) {
      values[current.slice(2)] = args[index + 1];
      index += 1;
    }
  }
  const result = await runBatch({ input: values.input, out: values.out, api: values.api, token: values.token });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) {
  main().catch((error: any) => {
    process.stderr.write(`${error}\n`);
    process.exit(1);
  });
}

module.exports = { runBatch, listInputs, payloadFor };
