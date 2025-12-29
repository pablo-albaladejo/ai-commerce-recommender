import { ShopifyProductBuilder } from '../../fixtures/shopify-product.builder';
import { ShopifyProductSchema } from '../types';
import {
  CatalogManager,
  loadCatalog,
  normalizeShopifyProduct,
} from './catalog';

describe('Catalog', () => {
  describe('normalizeShopifyProduct', () => {
    test('normalizes Shopify product correctly', () => {
      const shopifyProduct = ShopifyProductBuilder.build({
        id: 15336528478543,
        title: 'Test Ladder 3.5m',
        body_html:
          '<p>Professional <strong>aluminum ladder</strong> for safe work at height.</p>',
        vendor: 'TestVendor',
        product_type: 'Ladder',
        handle: 'test-ladder-35',
        tags: 'ladder, professional, safety',
        variants: [
          {
            id: 55013348573519,
            product_id: 15336528478543,
            title: '3.5m',
            price: '150.00',
            sku: 'LAD001',
            position: 1,
            compare_at_price: '180.00',
            fulfillment_service: 'manual',
            inventory_management: 'shopify',
            option1: '3.5m',
            option2: null,
            option3: null,
            created_at: '2025-04-30T10:09:31+02:00',
            updated_at: '2025-12-28T20:33:04+01:00',
            taxable: true,
            barcode: '1234567890',
            grams: 5000,
            image_id: 77099412422991,
            weight: 5,
            weight_unit: 'kg',
            requires_shipping: true,
            price_currency: 'EUR',
            compare_at_price_currency: 'EUR',
          },
        ],
        images: [
          {
            id: 77099412422991,
            product_id: 15336528478543,
            position: 1,
            created_at: '2025-04-30T10:09:31+02:00',
            updated_at: '2025-12-28T20:33:04+01:00',
            alt: 'Test Ladder',
            width: 800,
            height: 600,
            src: 'https://example.com/ladder.jpg',
            variant_ids: [55013348573519],
          },
        ],
      });

      // Validate the builder output against schema
      const validationResult = ShopifyProductSchema.safeParse(shopifyProduct);
      expect(validationResult.success).toBe(true);

      const normalized = normalizeShopifyProduct(shopifyProduct);

      expect(normalized).toEqual({
        id: 15336528478543,
        title: 'Test Ladder 3.5m',
        url: '/products/test-ladder-35',
        vendor: 'TestVendor',
        product_type: 'Ladder',
        tags: ['ladder', 'professional', 'safety'],
        available: true,
        price_min: 150.0,
        price_max: 150.0,
        images: [
          {
            src: 'https://example.com/ladder.jpg',
            alt: 'Test Ladder',
          },
        ],
        description_text:
          'Professional aluminum ladder for safe work at height.',
        doc_text:
          'test ladder 3.5m professional aluminum ladder for safe work at height. testvendor ladder ladder professional safety',
        variants: [
          {
            sku: 'LAD001',
            price: 150.0,
            available: true,
            title: '3.5m',
          },
        ],
      });
    });

    test('handles missing optional fields', () => {
      const minimalProduct = ShopifyProductBuilder.build({
        body_html: undefined,
        images: undefined,
        variants: [ShopifyProductBuilder.build().variants[0]],
      });

      // Remove sku from the variant
      if (minimalProduct.variants[0]) {
        minimalProduct.variants[0].sku = undefined;
      }

      // Validate against schema
      const validationResult = ShopifyProductSchema.safeParse(minimalProduct);
      expect(validationResult.success).toBe(true);

      const normalized = normalizeShopifyProduct(minimalProduct);

      expect(normalized.description_text).toBe('');
      expect(normalized.images).toEqual([]);
      expect(normalized.variants?.[0]?.sku).toBeUndefined();
    });

    test('handles price ranges from multiple variants', () => {
      const baseProduct = ShopifyProductBuilder.build();
      const multiVariantProduct = ShopifyProductBuilder.build({
        id: baseProduct.id,
        variants: [
          { ...baseProduct.variants[0], price: '100.00' },
          {
            ...baseProduct.variants[0],
            id: baseProduct.variants[0].id + 1,
            price: '200.00',
          },
        ],
      });

      // Validate against schema
      const validationResult =
        ShopifyProductSchema.safeParse(multiVariantProduct);
      expect(validationResult.success).toBe(true);

      const normalized = normalizeShopifyProduct(multiVariantProduct);

      expect(normalized.price_min).toBe(100.0);
      expect(normalized.price_max).toBe(200.0);
    });
  });

  describe('loadCatalog', () => {
    // Suppress console warnings during tests
    const originalWarn = console.warn;
    beforeAll(() => {
      console.warn = jest.fn();
    });
    afterAll(() => {
      console.warn = originalWarn;
    });

    test('loads valid products and skips invalid ones', () => {
      const validProduct1 = ShopifyProductBuilder.build();
      const validProduct2 = ShopifyProductBuilder.build({
        id: validProduct1.id + 1,
        title: 'Another Product',
      });

      const catalogData = [
        validProduct1,
        { invalid: 'product' }, // Invalid product
        validProduct2,
      ];

      const products = loadCatalog(catalogData);

      expect(products).toHaveLength(2); // Only valid products
      expect(products[0].id).toBe(validProduct1.id);
      expect(products[1].id).toBe(validProduct2.id);
    });
  });

  describe('CatalogManager', () => {
    let catalogManager: CatalogManager;
    let testProduct: ReturnType<typeof ShopifyProductBuilder.build>;

    beforeEach(() => {
      testProduct = ShopifyProductBuilder.build();
      catalogManager = new CatalogManager([testProduct]);
    });

    test('initializes with products', () => {
      expect(catalogManager.getProductCount()).toBe(1);
    });

    test('gets all products', () => {
      const products = catalogManager.getAllProducts();
      expect(products).toHaveLength(1);
      expect(products[0].id).toBe(testProduct.id);
    });

    test('gets product by ID', () => {
      const product = catalogManager.getProduct(testProduct.id);
      expect(product).toBeDefined();
      expect(product?.title).toBe(testProduct.title);
    });

    test('returns undefined for non-existent product', () => {
      const product = catalogManager.getProduct(999);
      expect(product).toBeUndefined();
    });

    test('gets multiple products by IDs', () => {
      const products = catalogManager.getProducts([testProduct.id, 999]);
      expect(products).toHaveLength(1);
      expect(products[0].id).toBe(testProduct.id);
    });

    test('searches products by text', () => {
      const results = catalogManager.searchProducts(
        testProduct.title.toLowerCase()
      );
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(testProduct.id);
    });

    test('returns empty results for non-matching search', () => {
      const results = catalogManager.searchProducts('nonexistent');
      expect(results).toHaveLength(0);
    });

    test('loads new products', () => {
      const newProduct = ShopifyProductBuilder.build({
        id: testProduct.id + 1,
        title: 'New Product',
      });

      catalogManager.loadProducts([testProduct, newProduct]);
      expect(catalogManager.getProductCount()).toBe(2);
    });

    test('loads normalized products directly', () => {
      const normalized = loadCatalog([testProduct]);
      const emptyManager = new CatalogManager();

      emptyManager.loadNormalizedProducts(normalized);

      expect(emptyManager.getProductCount()).toBe(1);
      expect(emptyManager.getProduct(testProduct.id)).toBeDefined();
    });
  });
});
