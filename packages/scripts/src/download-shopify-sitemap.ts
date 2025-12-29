#!/usr/bin/env node

import type { ShopifyProduct } from '@ai-commerce/core';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import { parseStringPromise } from 'xml2js';

type SitemapUrl = {
  loc: string[];
  lastmod?: string[];
  changefreq?: string[];
  priority?: string[];
};

type SitemapData = {
  urlset: {
    url: SitemapUrl[];
  };
};

// ShopifyProduct type is imported from @ai-commerce/core to keep schemas consistent across the template.

const fetchUrl = async (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    };

    client
      .get(options, res => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      })
      .on('error', err => {
        reject(err);
      });
  });
};

const parseShopifySitemap = async (sitemapUrl: string): Promise<string[]> => {
  console.log(`Downloading Shopify sitemap: ${sitemapUrl}`);

  const xmlContent = await fetchUrl(sitemapUrl);
  const parsed = (await parseStringPromise(xmlContent)) as SitemapData;

  if (!parsed.urlset || !parsed.urlset.url) {
    throw new Error('Invalid sitemap format');
  }

  const productUrls = parsed.urlset.url
    .map(url => url.loc[0])
    .filter(url => url.includes('/products/'));

  console.log(`Found ${productUrls.length} product URLs`);
  return productUrls;
};

const fetchShopifyProductData = async (
  productUrl: string
): Promise<ShopifyProduct | null> => {
  try {
    // Convert product URL to Shopify JSON API URL
    const jsonUrl = productUrl.replace(/\/$/, '') + '.json';

    console.log(`Downloading product: ${jsonUrl}`);
    const jsonContent = await fetchUrl(jsonUrl);
    const productData = JSON.parse(jsonContent);

    return productData.product;
  } catch (error) {
    console.error(
      `Error downloading product ${productUrl}:`,
      (error as Error).message
    );
    return null;
  }
};

const delay = async (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const downloadShopifyProducts = async (
  sitemapUrl: string,
  outputDir: string
): Promise<void> => {
  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Parse sitemap to get product URLs
    const productUrls = await parseShopifySitemap(sitemapUrl);

    const products: ShopifyProduct[] = [];
    const batchSize = 5; // Process in batches to avoid rate limiting

    for (let i = 0; i < productUrls.length; i += batchSize) {
      const batch = productUrls.slice(i, i + batchSize);

      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(productUrls.length / batchSize)}`
      );

      const batchPromises = batch.map(url => fetchShopifyProductData(url));
      const batchResults = await Promise.all(batchPromises);

      // Filter valid products
      const validProducts = batchResults.filter(
        product => product !== null
      ) as ShopifyProduct[];
      products.push(...validProducts);

      // Delay between batches to be respectful to the server
      if (i + batchSize < productUrls.length) {
        await delay(1000);
      }
    }

    // Save products to JSON file
    const outputPath = path.join(outputDir, 'shopify-products.json');
    fs.writeFileSync(outputPath, JSON.stringify(products, null, 2));

    console.log(
      `✅ Download completed: ${products.length} products saved to ${outputPath}`
    );
  } catch (error) {
    console.error('❌ Error during download:', (error as Error).message);
    process.exit(1);
  }
};

// CLI Interface
const main = async (): Promise<void> => {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(
      'Usage: pnpm download:shopify-sitemap <sitemap-url> <output-directory>'
    );
    console.log('');
    console.log('Example:');
    console.log(
      '  pnpm download:shopify-sitemap https://itower.es/sitemap_products_1.xml ./data'
    );
    process.exit(1);
  }

  const [sitemapUrl, outputDir] = args;

  console.log('🚀 Starting Shopify product download from sitemap...');
  console.log(`📍 Sitemap: ${sitemapUrl}`);
  console.log(`📁 Output directory: ${outputDir}`);
  console.log('');

  await downloadShopifyProducts(sitemapUrl, outputDir);
};

if (require.main === module) {
  main().catch(console.error);
}

export {
  downloadShopifyProducts,
  fetchShopifyProductData,
  parseShopifySitemap,
};
