import fs from 'fs';
import path from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { storageConfig } from '../config/storage.js';

const s3Client = storageConfig.driver === 's3'
  ? new S3Client({ region: storageConfig.aws.region, credentials: storageConfig.aws.credentials })
  : null;

export const saveBuffer = async ({ key, buffer, contentType }) => {
  if (storageConfig.driver === 's3') {
    await s3Client.send(new PutObjectCommand({
      Bucket: storageConfig.aws.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType
    }));
    return {
      key,
      url: `https://${storageConfig.aws.bucket}.s3.${storageConfig.aws.region}.amazonaws.com/${key}`
    };
  }

  const fullPath = path.join(storageConfig.localRoot, key);
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.promises.writeFile(fullPath, buffer);
  return { key, url: `${storageConfig.publicBaseUrl}/${key.replaceAll('\\', '/')}` };
};
