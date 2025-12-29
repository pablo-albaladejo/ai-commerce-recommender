/**
 * Integration tests for Product_Selector with real catalog data
 */

import fs from 'fs';
import path from 'path';
import { CatalogManager } from './catalog/catalog';
import { ProductSelector } from './product-selector/product-selector';

describe('Product_Selector Integration', () => {
  let catalogManager: CatalogManager;
  let productSelector: ProductSelector;

  beforeAll(() => {
    // Try to load real catalog data, fall back to mock if not available
    let catalogData: unknown[] = [];

    try {
      const catalogPath = path.join(
        __dirname,
        '../../../data/itower/shopify-products.json'
      );
      const rawData = fs.readFileSync(catalogPath, 'utf-8');
      catalogData = JSON.parse(rawData);
    } catch {
      // Use minimal mock data for CI/testing environments
      catalogData = [
        {
          id: 1,
          title: 'Test Product',
          body_html: '<p>Test description</p>',
          vendor: 'Test Vendor',
          product_type: 'Test Type',
          created_at: '2025-01-01T00:00:00Z',
          handle: 'test-product',
          updated_at: '2025-01-01T00:00:00Z',
          published_at: '2025-01-01T00:00:00Z',
          tags: 'test, product',
          variants: [
            {
              id: 101,
              product_id: 1,
              title: 'Default',
              price: '100.00',
              sku: 'TEST001',
              position: 1,
              compare_at_price: null,
              fulfillment_service: 'manual',
              inventory_management: 'shopify',
              option1: 'Default',
              option2: null,
              option3: null,
              created_at: '2025-01-01T00:00:00Z',
              updated_at: '2025-01-01T00:00:00Z',
              taxable: true,
              barcode: 'TEST001',
              grams: 1000,
              image_id: null,
              weight: 1,
              weight_unit: 'kg',
              requires_shipping: true,
              price_currency: 'EUR',
              compare_at_price_currency: 'EUR',
            },
          ],
          images: [],
        },
      ];
    }

    catalogManager = new CatalogManager(catalogData);
    productSelector = new ProductSelector(catalogManager);
  });

  test('loads catalog and provides basic functionality', () => {
    const stats = productSelector.getCatalogStats();

    expect(stats.total_products).toBeGreaterThan(0);
    expect(stats.vendors.length).toBeGreaterThan(0);
    expect(stats.price_range.min).toBeGreaterThan(0);
    expect(stats.price_range.max).toBeGreaterThanOrEqual(stats.price_range.min);
  });

  test('selects products without query (browsing)', async () => {
    const result = await productSelector.selectProducts();

    expect(result.products).toBeDefined();
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products.length).toBeLessThanOrEqual(10); // Max limit
    expect(result.total_found).toBeGreaterThan(0);

    // Check product card format
    const firstProduct = result.products[0];
    expect(firstProduct.id).toBeDefined();
    expect(firstProduct.title).toBeDefined();
    expect(firstProduct.price).toMatch(/€\d+/); // Price format
    expect(firstProduct.description.length).toBeLessThanOrEqual(150); // Token optimization
  });

  test('searches products with query', async () => {
    const result = await productSelector.selectProducts({ query: 'product' });

    expect(result.products).toBeDefined();
    expect(result.search_query).toBe('product');
    expect(result.debug).toBeDefined();

    // Should have ranking debug info
    expect(result.debug?.fused_top).toBeDefined();
  });

  test('applies filters correctly', async () => {
    const stats = productSelector.getCatalogStats();
    const midPrice = (stats.price_range.min + stats.price_range.max) / 2;

    const result = await productSelector.selectProducts({
      filters: {
        max_price: midPrice,
        available_only: true,
      },
    });

    expect(result.products).toBeDefined();
    expect(result.filters_applied?.max_price).toBe(midPrice);
    expect(result.filters_applied?.available_only).toBe(true);

    // All returned products should be under the price limit
    result.products.forEach(product => {
      const productData = catalogManager.getProduct(product.id);
      expect(productData?.price_max).toBeLessThanOrEqual(midPrice);
    });
  });

  test('extracts filters from query', async () => {
    const result = await productSelector.selectProducts({ query: 'under 500' });

    expect(result.filters_applied?.max_price).toBe(500);
  });

  test('limits results appropriately', async () => {
    const result = await productSelector.selectProducts({ maxResults: 3 });

    expect(result.products.length).toBeLessThanOrEqual(3);
  });

  test('gets products by IDs', () => {
    const allProducts = catalogManager.getAllProducts();
    if (allProducts.length >= 2) {
      const ids = allProducts.slice(0, 2).map(p => p.id);
      const cards = productSelector.getProductsByIds(ids);

      expect(cards).toHaveLength(2);
      expect(cards[0].id).toBe(ids[0]);
      expect(cards[1].id).toBe(ids[1]);
    }
  });

  test('finds similar products', () => {
    const allProducts = catalogManager.getAllProducts();
    if (allProducts.length > 1) {
      const referenceId = allProducts[0].id;
      const similar = productSelector.getSimilarProducts(referenceId, 3);

      // Should not include the reference product itself
      expect(similar.every(p => p.id !== referenceId)).toBe(true);
      expect(similar.length).toBeLessThanOrEqual(3);
    }
  });

  test('optimizes product cards for LLM context', async () => {
    const result = await productSelector.selectProducts();

    result.products.forEach(product => {
      // Check token optimization
      expect(product.description.length).toBeLessThanOrEqual(150);
      expect(product.tags.length).toBeLessThanOrEqual(3); // Limited tags
      expect(product.price).toMatch(/€\d+/); // Formatted price

      // Check required fields
      expect(product.id).toBeDefined();
      expect(product.title).toBeDefined();
      expect(product.vendor).toBeDefined();
      expect(product.type).toBeDefined();
      expect(product.url).toBeDefined();
    });
  });
});
