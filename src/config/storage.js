import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const storageConfig = {
  driver: env.storage.driver,
  localRoot: path.resolve(__dirname, '../../storage'),
  publicBaseUrl: `${env.storage.appBaseUrl}/files`,
  aws: {
    region: env.storage.awsRegion,
    bucket: env.storage.awsBucket,
    credentials: {
      accessKeyId: env.storage.awsAccessKeyId,
      secretAccessKey: env.storage.awsSecretAccessKey
    }
  }
};
