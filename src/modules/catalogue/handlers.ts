/**
 * Adapts catalogue import requests into durable jobs.
 * Sources are validated before job input is saved to storage or the database.
 */
import AppError = require('../../shared/errors/AppError');
import * as jobs from '../jobs/service';
import { parseRecords } from './csv';
import { publicHttpUrl } from './service';

const MAX_CSV_BYTES = 5 * 1024 * 1024;

function tooLarge(): AppError {
  return new AppError('PAYLOAD_TOO_LARGE', 'Catalogue CSV exceeds the 5 MB limit', {
    statusCode: 413
  });
}

async function readLimitedResponse(response: any): Promise<Buffer> {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_CSV_BYTES) throw tooLarge();
  if (!response.body) {
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > MAX_CSV_BYTES) throw tooLarge();
    return body;
  }
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > MAX_CSV_BYTES) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(Buffer.from(part.value));
  }
  return Buffer.concat(chunks, size);
}

async function fetchCsv(urlValue: string, options: any): Promise<Buffer> {
  let url: URL;
  try {
    url = publicHttpUrl(urlValue);
  } catch (error: any) {
    throw new AppError('VALIDATION_ERROR', 'Catalogue source URL is not allowed', {
      statusCode: 400,
      details: { reason: error.message }
    });
  }
  const fetcher = options.fetcher || fetch;
  const response = await fetcher(url.toString(), {
    redirect: 'manual',
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) {
    throw new AppError('VALIDATION_ERROR', 'Catalogue source URL could not be fetched', {
      statusCode: 400,
      details: { status: response.status }
    });
  }
  return readLimitedResponse(response);
}

async function readCsvSource(body: any, options: any): Promise<{ name: string; bytes: Buffer }> {
  if (body.source.upload) {
    const encoded = body.source.upload.content_base64;
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
      throw new AppError('VALIDATION_ERROR', 'CSV upload is not valid base64', { statusCode: 400 });
    }
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length > MAX_CSV_BYTES) {
      throw new AppError('PAYLOAD_TOO_LARGE', 'Catalogue CSV exceeds the 5 MB limit', {
        statusCode: 413
      });
    }
    return { name: body.source.upload.name, bytes };
  }
  const bytes = await fetchCsv(body.source.url, options);
  return { name: 'catalogue.csv', bytes };
}

async function create(request: any, reply: any): Promise<any> {
  const source = await readCsvSource(request.body, request.server.catalogueOptions || {});
  try {
    const rows = parseRecords(source.bytes.toString('utf8'));
    if (!rows.length) throw new Error('CSV must contain at least one data row');
  } catch (error: any) {
    throw new AppError('VALIDATION_ERROR', 'Catalogue CSV is invalid', {
      statusCode: 400,
      details: { reason: error.message }
    });
  }
  const job = await jobs.create(request.server, {
    type: 'catalogue_import',
    input: {
      source: {
        upload: { name: source.name, content_base64: source.bytes.toString('base64') }
      }
    }
  }, request.id);
  reply.code(202);
  return { job_id: job.id, status: 'queued', progress: 0 };
}

export { create };
