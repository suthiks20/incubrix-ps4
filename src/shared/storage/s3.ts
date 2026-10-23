/**
 * Adapts the S3-compatible MinIO API to the application's small storage port.
 * The adapter uses env-driven credentials and never logs object contents.
 */
import { GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Storage } from './local';

function createS3(config: any): Storage {
  const client = new S3Client({ endpoint: config.S3_ENDPOINT, region: config.S3_REGION, forcePathStyle: true,
    credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY } });
  const bucket = config.S3_BUCKET;
  return {
    async put(key, value) { await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: value })); },
    async get(key) {
      const response: any = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const bytes = await response.Body.transformToByteArray();
      return Buffer.from(bytes);
    },
    async exists(key) {
      try { await client.send(new GetObjectCommand({ Bucket: bucket, Key: key })); return true; } catch { return false; }
    },
    async list(prefix = '') {
      const response = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
      return (response.Contents || []).flatMap((item) => item.Key ? [item.Key] : []);
    },
    async ready() { await client.send(new HeadBucketCommand({ Bucket: bucket })); }
  };
}

export { createS3 };
