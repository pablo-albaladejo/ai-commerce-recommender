#!/usr/bin/env node

import { CatalogManager, ShopifyProductSchema } from '@ai-commerce/core';
import * as fs from 'fs';
import * as path from 'path';

type BuildIndexConfig = {
  inputFile: string;
  outputDir: string;
};

const resolveConfig = (): BuildIndexConfig => {
  const args = process.argv.slice(2);

  const inputFile = args[0] || process.env.CATALOG_INPUT_FILE;
  const outputDir = args[1] || process.env.ARTIFACTS_DIR || './artifacts';

  if (!inputFile) {
    // eslint-disable-next-line no-console
    console.error(
      [
        'Missing input catalog file.',
        '',
        'Usage:',
        '  pnpm --filter @ai-commerce/scripts build:index -- <input-file> [output-dir]',
        '',
        'Or set env vars:',
        '  CATALOG_INPUT_FILE=./data/<merchant>/shopify-products.json pnpm index:build',
      ].join('\n')
    );
    process.exit(1);
  }

  return {
    inputFile: path.resolve(process.cwd(), inputFile),
    outputDir: path.resolve(process.cwd(), outputDir),
  };
};

const readJsonArrayFile = (filePath: string): unknown[] => {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected JSON array in ${filePath}`);
  }
  return parsed;
};

const ensureDir = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

const writeJsonFile = (filePath: string, data: unknown): void => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const countValidShopifyProducts = (items: unknown[]): number =>
  items.reduce<number>((count, item) => {
    const parsed = ShopifyProductSchema.safeParse(item);
    return parsed.success ? count + 1 : count;
  }, 0);

const main = async (): Promise<void> => {
  const cfg = resolveConfig();
  // eslint-disable-next-line no-console
  console.log(`Reading input catalog: ${cfg.inputFile}`);

  const rawItems = readJsonArrayFile(cfg.inputFile);
  const validCount = countValidShopifyProducts(rawItems);

  // Normalize via core (invalid entries will be skipped by schema parsing)
  const catalogManager = new CatalogManager(rawItems);
  const normalizedProducts = catalogManager.getAllProducts();

  ensureDir(cfg.outputDir);

  const rawOut = path.join(cfg.outputDir, 'shopify-products.json');
  const normalizedOut = path.join(cfg.outputDir, 'catalog.json');
  const manifestOut = path.join(cfg.outputDir, 'manifest.json');

  writeJsonFile(rawOut, rawItems);
  writeJsonFile(normalizedOut, normalizedProducts);
  writeJsonFile(manifestOut, {
    generatedAt: new Date().toISOString(),
    inputFile: cfg.inputFile,
    inputCount: rawItems.length,
    inputValidShopifyCount: validCount,
    normalizedCount: normalizedProducts.length,
    notes: [
      'catalog.json contains normalized products for fast runtime loading.',
      'shopify-products.json is the raw Shopify product array downloaded from the public .json endpoint.',
    ],
  });

  // eslint-disable-next-line no-console
  console.log(
    `Built artifacts in ${cfg.outputDir} (normalized: ${normalizedProducts.length}/${rawItems.length})`
  );
};

if (require.main === module) {
  main().catch(err => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
