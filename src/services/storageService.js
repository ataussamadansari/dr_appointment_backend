import fs from 'fs';
import path from 'path';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { storageConfig } from '../config/storage.js';

const s3Client = storageConfig.driver === 's3'
  ? new S3Client({ region: storageConfig.aws.region, credentials: storageConfig.aws.credentials })
  : null;

export const saveBuffer = async ({ key, buffer, contentType }) => {
  if (storageConfig.driver === 's3') {
    if (!s3Client || !storageConfig.aws.bucket || !storageConfig.aws.region) {
      throw new Error('S3 storage is not configured');
    }
    await s3Client.send(new PutObjectCommand({
      Bucket: storageConfig.aws.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: 'AES256'
    }));
    return {
      key,
      url: `s3://${storageConfig.aws.bucket}/${key}`
    };
  }

  const fullPath = path.join(storageConfig.localRoot, key);
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.promises.writeFile(fullPath, buffer);
  return { key, url: `${storageConfig.publicBaseUrl}/${key.replaceAll('\\', '/')}` };
};

export const getFileUrl = async (key, { expiresIn = 15 * 60 } = {}) => {
  if (!key) return '';
  if (storageConfig.driver === 's3') {
    if (!s3Client || !storageConfig.aws.bucket || !storageConfig.aws.region) {
      throw new Error('S3 storage is not configured');
    }
    return getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: storageConfig.aws.bucket, Key: key }),
      { expiresIn }
    );
  }
  return `${storageConfig.publicBaseUrl}/${key.replaceAll('\\', '/')}`;
};

export const resolveStoredFileUrl = async ({ key, url }) => {
  if (key) return getFileUrl(key);
  return url || '';
};
