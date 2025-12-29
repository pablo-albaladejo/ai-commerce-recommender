#!/usr/bin/env node

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

type UploadConfig = {
  bucket: string;
  prefix: string;
  artifactsDir: string;
  region?: string;
};

const normalizePrefix = (prefix: string | undefined): string => {
  const p = (prefix || '').trim();
  if (!p) return '';
  return p.endsWith('/') ? p : `${p}/`;
};

const resolveConfig = (): UploadConfig => {
  const args = process.argv.slice(2);

  const bucket = args[0] || process.env.CATALOG_BUCKET;
  const prefix = normalizePrefix(args[1] || process.env.CATALOG_PREFIX);
  const artifactsDir = path.resolve(
    process.cwd(),
    args[2] || process.env.ARTIFACTS_DIR || './artifacts'
  );
  const region = process.env.AWS_REGION;

  if (!bucket) {
    // eslint-disable-next-line no-console
    console.error(
      [
        'Missing CATALOG_BUCKET.',
        '',
        'Usage:',
        '  pnpm --filter @ai-commerce/scripts upload:artifacts -- <bucket> [prefix] [artifacts-dir]',
        '',
        'Or set env vars:',
        '  CATALOG_BUCKET=... CATALOG_PREFIX=... pnpm index:upload',
      ].join('\n')
    );
    process.exit(1);
  }

  return { bucket, prefix, artifactsDir, region };
};

const readFileBuffer = (filePath: string): Buffer => fs.readFileSync(filePath);

const fileExists = (filePath: string): boolean => {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
};

const uploadFile = async (
  s3: S3Client,
  bucket: string,
  key: string,
  filePath: string
): Promise<void> => {
  const body = readFileBuffer(filePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
    })
  );
};

const main = async (): Promise<void> => {
  const cfg = resolveConfig();
  const s3 = new S3Client({ region: cfg.region });

  const catalogPath = path.join(cfg.artifactsDir, 'catalog.json');
  const rawPath = path.join(cfg.artifactsDir, 'shopify-products.json');
  const manifestPath = path.join(cfg.artifactsDir, 'manifest.json');

  if (!fileExists(catalogPath)) {
    throw new Error(
      `Missing artifacts file: ${catalogPath}. Run pnpm index:build first.`
    );
  }

  const uploads: Array<{ filePath: string; key: string }> = [
    { filePath: catalogPath, key: `${cfg.prefix}catalog.json` },
  ];
  if (fileExists(rawPath)) {
    uploads.push({
      filePath: rawPath,
      key: `${cfg.prefix}shopify-products.json`,
    });
  }
  if (fileExists(manifestPath)) {
    uploads.push({ filePath: manifestPath, key: `${cfg.prefix}manifest.json` });
  }

  // eslint-disable-next-line no-console
  console.log(
    `Uploading ${uploads.length} artifact(s) to s3://${cfg.bucket}/${cfg.prefix}`
  );

  for (const u of uploads) {
    // eslint-disable-next-line no-console
    console.log(`- ${path.basename(u.filePath)} -> ${u.key}`);
    await uploadFile(s3, cfg.bucket, u.key, u.filePath);
  }

  // eslint-disable-next-line no-console
  console.log('Upload complete.');
};

if (require.main === module) {
  main().catch(err => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
