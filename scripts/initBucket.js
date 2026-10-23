/**
 * Creates the configured S3-compatible bucket when the local stack starts.
 * Repeated starts are safe because an existing bucket is accepted unchanged.
 */
const { CreateBucketCommand, S3Client } = require('@aws-sdk/client-s3');

const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

const MAX_ATTEMPTS = 12;
const RETRY_DELAY_MS = 2000;

function isRetryable(error) {
  return error && (
    error.name === 'TimeoutError'
    || error.code === 'ECONNRESET'
    || error.code === 'ECONNREFUSED'
    || error.message?.includes('connect')
    || error.message?.includes('ECONNREFUSED')
    || error.$metadata?.httpStatusCode >= 500
  );
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureBucket() {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await client.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET }));
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === MAX_ATTEMPTS) {
        if (!['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(error.name)) {
          throw error;
        }
        return;
      }

      process.stderr.write(`Storage bucket setup attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error.message}; retrying...\n`);
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw lastError;
}

async function main() {
  await ensureBucket();
  process.stdout.write('Storage bucket is ready\n');
}

main().catch((error) => { process.stderr.write(`Storage bucket setup failed: ${error.message}\n`); process.exit(1); });
