/**
 * Creates the configured S3-compatible bucket when the local stack starts.
 * Repeated starts are safe because an existing bucket is accepted unchanged.
 */
const { CreateBucketCommand, S3Client } = require('@aws-sdk/client-s3');

const client = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION,
  forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY } });

async function main() {
  try { await client.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET })); }
  catch (error) {
    if (!['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(error.name)) throw error;
  }
  process.stdout.write('Storage bucket is ready\n');
}

main().catch((error) => { process.stderr.write(`Storage bucket setup failed: ${error.message}\n`); process.exit(1); });
