import { S3Client } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
dotenv.config();

export const s3Client = new S3Client({
  region: process.env.AWS_REGION as string,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

export const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME as string;

console.log('ENV', {
  REGION: process.env.AWS_REGION,
  ID: process.env.AWS_ACCESS_KEY_ID,
  SECRET: process.env.AWS_SECRET_ACCESS_KEY,
  BUCKET: process.env.AWS_S3_BUCKET_NAME,
});
