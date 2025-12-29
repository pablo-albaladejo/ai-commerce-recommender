import { ProductBuilder } from '../../fixtures';
import type { CatalogManager } from '../catalog/catalog';
import type { NormalizedProduct, SearchFilters } from '../types';
import { ProductSelector, formatProductCard } from './product-selector';

// Mock dependencies
jest.mock('../catalog/catalog');
jest.mock('../filters', () => ({
  applyFilters: jest.fn(products => products),
  extractFiltersFromQuery: jest.fn(() => ({})),
  validateFilters: jest.fn(filters => ({
    limit: 10,
    available_only: true,
    ...filters,
  })),
}));
jest.mock('../ranking', () => ({
  rankProducts: jest.fn(() => ({
    scores: [
      { id: 1, score: 0.95, rank: 1, source: 'fused' },
      { id: 2, score: 0.85, rank: 2, source: 'fused' },
      { id: 3, score: 0.75, rank: 3, source: 'fused' },
    ],
  })),
}));

import {
  applyFilters,
  extractFiltersFromQuery,
  validateFilters,
} from '../filters';
import { rankProducts } from '../ranking';

type MockCatalogManager = {
  getAllProducts: jest.Mock;
  getProducts: jest.Mock;
  getProduct: jest.Mock;
};

describe('ProductSelector', () => {
  let mockCatalogManager: MockCatalogManager;
  let productSelector: ProductSelector;
  let mockProducts: NormalizedProduct[];

  beforeEach(() => {
    mockProducts = [
      ProductBuilder.build({
        id: 1,
        title: 'Product 1',
        price_min: 10,
        price_max: 15,
      }),
      ProductBuilder.build({
        id: 2,
        title: 'Product 2',
        price_min: 20,
        price_max: 25,
      }),
      ProductBuilder.build({
        id: 3,
        title: 'Product 3',
        price_min: 30,
        price_max: 35,
      }),
    ];

    mockCatalogManager = {
      getAllProducts: jest.fn(() => mockProducts),
      getProducts: jest.fn((ids: number[]) =>
        mockProducts.filter(p => ids.includes(p.id))
      ),
      getProduct: jest.fn(
        (id: number) => mockProducts.find(p => p.id === id) || undefined
      ),
    };

    productSelector = new ProductSelector(
      mockCatalogManager as unknown as CatalogManager
    );

    // Reset mocks
    (applyFilters as jest.Mock).mockImplementation(products => products);
    (extractFiltersFromQuery as jest.Mock).mockReturnValue({});
    (validateFilters as jest.Mock).mockImplementation(filters => ({
      limit: 10,
      available_only: true,
      ...filters,
    }));
    (rankProducts as jest.Mock).mockReturnValue({
      scores: [
        { id: 1, score: 0.95, rank: 1, source: 'fused' },
        { id: 2, score: 0.85, rank: 2, source: 'fused' },
        { id: 3, score: 0.75, rank: 3, source: 'fused' },
      ],
    });
  });

  describe('formatProductCard', () => {
    test('formats product card with all fields', () => {
      const product = ProductBuilder.build({
        id: 123,
        title: 'Test Product',
        price_min: 19.99,
        price_max: 29.99,
        vendor: 'Test Vendor',
        product_type: 'Electronics',
        tags: ['tag1', 'tag2', 'tag3', 'tag4'],
        description_text: 'This is a test product description',
        url: 'https://example.com/product/123',
        images: [{ src: 'https://example.com/image.jpg' }],
      });

      const result = formatProductCard(product, 'Best match');

      expect(result).toEqual({
        id: 123,
        title: 'Test Product',
        price: '€19.99-29.99',
        vendor: 'Test Vendor',
        type: 'Electronics',
        tags: ['tag1', 'tag2', 'tag3'], // Limited to 3
        description: 'This is a test product description',
        url: 'https://example.com/product/123',
        image: 'https://example.com/image.jpg',
        reason: 'Best match',
      });
    });

    test('formats single price correctly', () => {
      const product = ProductBuilder.build({
        price_min: 19.99,
        price_max: 19.99,
      });

      const result = formatProductCard(product);
      expect(result.price).toBe('€19.99');
    });

    test('truncates long description', () => {
      const longDescription = 'A'.repeat(200);
      const product = ProductBuilder.build({
        description_text: longDescription,
      });

      const result = formatProductCard(product);
      expect(result.description.length).toBeLessThanOrEqual(150);
      expect(result.description).toMatch(/\.\.\.$/); // Ends with ...
    });

    test('handles missing image', () => {
      const product = ProductBuilder.build({
        images: [],
      });

      const result = formatProductCard(product);
      expect(result.image).toBeUndefined();
    });

    test('limits tags to 3 items', () => {
      const product = ProductBuilder.build({
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
      });

      const result = formatProductCard(product);
      expect(result.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    test('handles missing product type', () => {
      const product = ProductBuilder.build({
        product_type: '',
      });

      const result = formatProductCard(product);
      expect(result.type).toBe('Product');
    });
  });

  describe('selectProducts', () => {
    test('selects products with query using ranking', async () => {
      const query = 'test query';
      const filters: Partial<SearchFilters> = { max_price: 50 };

      const result = await productSelector.selectProducts({
        query,
        filters,
        maxResults: 5,
      });

      expect(validateFilters).toHaveBeenCalledWith({
        ...filters,
        query,
        limit: 5,
      });
      expect(mockCatalogManager.getAllProducts).toHaveBeenCalled();
      expect(applyFilters).toHaveBeenCalledWith(
        mockProducts,
        expect.any(Object)
      );
      expect(rankProducts).toHaveBeenCalledWith(query, mockProducts);
      expect(mockCatalogManager.getProducts).toHaveBeenCalledWith([1, 2, 3]);

      expect(result).toEqual({
        products: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            reason: 'Best match for your query',
          }),
          expect.objectContaining({
            id: 2,
            reason: 'Highly relevant',
          }),
          expect.objectContaining({
            id: 3,
            reason: 'Highly relevant',
          }),
        ]),
        total_found: 3,
        search_query: query,
        filters_applied: expect.any(Object),
        debug: expect.objectContaining({
          bm25_top: [1, 2, 3],
          semantic_top: [1, 2, 3],
          fused_top: [1, 2, 3],
          filtered_count: 3,
        }),
      });
    });

    test('selects products without query (browsing mode)', async () => {
      const result = await productSelector.selectProducts({});

      // In browsing mode, ranking might still be called with empty query
      expect(result.products).toHaveLength(3);
      expect(result.search_query).toBeUndefined();
      expect(result.debug).toEqual({
        filtered_count: 3,
      });
    });

    test('enforces maximum limit of 10 products', async () => {
      await productSelector.selectProducts({ query: 'query', maxResults: 20 });

      expect(validateFilters).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 })
      );
    });

    test('extracts filters from query', async () => {
      const query = 'red shoes under $50';
      (extractFiltersFromQuery as jest.Mock).mockReturnValue({
        max_price: 50,
        tags: ['red'],
      });

      await productSelector.selectProducts({ query });

      expect(extractFiltersFromQuery).toHaveBeenCalledWith(query);
      expect(validateFilters).toHaveBeenCalled();
    });

    test('does not override explicit filters with extracted ones', async () => {
      const query = 'red shoes under $50';
      const filters = { max_price: 100 }; // Explicit filter
      (extractFiltersFromQuery as jest.Mock).mockReturnValue({
        max_price: 50, // Extracted filter (should be ignored)
        tags: ['red'], // New filter (should be used)
      });

      await productSelector.selectProducts({ query, filters });

      expect(extractFiltersFromQuery).toHaveBeenCalledWith(query);
      expect(validateFilters).toHaveBeenCalled();
    });

    test('assigns appropriate reasons based on ranking position', async () => {
      const result = await productSelector.selectProducts({
        query: 'test query',
      });

      expect(result.products[0].reason).toBe('Best match for your query');
      expect(result.products[1].reason).toBe('Highly relevant');
      expect(result.products[2].reason).toBe('Highly relevant');
    });

    test('assigns "Good alternative" reason for lower ranked products', async () => {
      // Mock more products to test lower rankings
      const moreProducts = Array.from({ length: 10 }, (_, i) =>
        ProductBuilder.build({ id: i + 1, title: `Product ${i + 1}` })
      );
      mockCatalogManager.getAllProducts.mockReturnValue(moreProducts);
      mockCatalogManager.getProducts.mockImplementation((ids: number[]) =>
        moreProducts.filter(p => ids.includes(p.id))
      );

      (rankProducts as jest.Mock).mockReturnValue({
        scores: moreProducts.map((p, i) => ({
          id: p.id,
          score: 1 - i * 0.1,
          rank: i + 1,
          source: 'fused',
        })),
      });

      const result = await productSelector.selectProducts({
        query: 'test query',
      });

      expect(result.products[0].reason).toBe('Best match for your query');
      expect(result.products[1].reason).toBe('Highly relevant');
      expect(result.products[2].reason).toBe('Highly relevant');
      expect(result.products[3].reason).toBe('Good alternative');
    });
  });

  describe('getProductsByIds', () => {
    test('returns products for given IDs', () => {
      const ids = [1, 3];
      const result = productSelector.getProductsByIds(ids);

      expect(mockCatalogManager.getProducts).toHaveBeenCalledWith(ids);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(3);
    });

    test('handles empty ID array', () => {
      const result = productSelector.getProductsByIds([]);

      expect(result).toEqual([]);
    });

    test('handles non-existent IDs', () => {
      mockCatalogManager.getProducts.mockReturnValue([]);

      const result = productSelector.getProductsByIds([999]);

      expect(result).toEqual([]);
    });
  });

  describe('getSimilarProducts', () => {
    test('finds similar products based on product type and vendor', () => {
      const referenceProduct = ProductBuilder.build({
        id: 1,
        product_type: 'Electronics',
        vendor: 'Apple',
        tags: ['smartphone', 'ios'],
        price_min: 500,
      });

      const similarProduct1 = ProductBuilder.build({
        id: 2,
        product_type: 'Electronics', // Same type (+3)
        vendor: 'Apple', // Same vendor (+2)
        tags: ['smartphone', 'mobile'], // 1 shared tag (+1)
        price_min: 600, // Similar price (+1)
      });

      const similarProduct2 = ProductBuilder.build({
        id: 3,
        product_type: 'Electronics', // Same type (+3)
        vendor: 'Samsung', // Different vendor
        tags: ['smartphone'], // 1 shared tag (+1)
        price_min: 450, // Similar price (+1)
      });

      const dissimilarProduct = ProductBuilder.build({
        id: 4,
        product_type: 'Clothing',
        vendor: 'Nike',
        tags: ['shoes'],
        price_min: 100,
      });

      mockCatalogManager.getProduct.mockReturnValue(referenceProduct);
      mockCatalogManager.getAllProducts.mockReturnValue([
        referenceProduct,
        similarProduct1,
        similarProduct2,
        dissimilarProduct,
      ]);

      const result = productSelector.getSimilarProducts(1, 3);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(2); // Should be most similar
      expect(result[1].id).toBe(3); // Should be second most similar
      expect(result[0].reason).toBe('Similar product');
    });

    test('returns empty array for non-existent product', () => {
      mockCatalogManager.getProduct.mockReturnValue(undefined);

      const result = productSelector.getSimilarProducts(999);

      expect(result).toEqual([]);
    });

    test('excludes reference product from results', () => {
      const referenceProduct = ProductBuilder.build({ id: 1 });
      mockCatalogManager.getProduct.mockReturnValue(referenceProduct);
      mockCatalogManager.getAllProducts.mockReturnValue([referenceProduct]);

      const result = productSelector.getSimilarProducts(1);

      expect(result).toEqual([]);
    });

    test('respects limit parameter', () => {
      const referenceProduct = ProductBuilder.build({
        id: 1,
        product_type: 'Electronics',
      });

      const similarProducts = Array.from({ length: 10 }, (_, i) =>
        ProductBuilder.build({
          id: i + 2,
          product_type: 'Electronics',
        })
      );

      mockCatalogManager.getProduct.mockReturnValue(referenceProduct);
      mockCatalogManager.getAllProducts.mockReturnValue([
        referenceProduct,
        ...similarProducts,
      ]);

      const result = productSelector.getSimilarProducts(1, 3);

      expect(result).toHaveLength(3);
    });

    test('handles products with no similarity', () => {
      const referenceProduct = ProductBuilder.build({
        id: 1,
        product_type: 'Electronics',
        vendor: 'Apple',
        tags: ['smartphone'],
        price_min: 500,
      });

      const dissimilarProduct = ProductBuilder.build({
        id: 2,
        product_type: 'Clothing',
        vendor: 'Nike',
        tags: ['shoes'],
        price_min: 100,
      });

      mockCatalogManager.getProduct.mockReturnValue(referenceProduct);
      mockCatalogManager.getAllProducts.mockReturnValue([
        referenceProduct,
        dissimilarProduct,
      ]);

      const result = productSelector.getSimilarProducts(1);

      expect(result).toEqual([]);
    });
  });

  describe('getCatalogStats', () => {
    test('returns catalog statistics', () => {
      const products = [
        ProductBuilder.build({
          vendor: 'Apple',
          product_type: 'Electronics',
          price_min: 100,
          price_max: 200,
        }),
        ProductBuilder.build({
          vendor: 'Samsung',
          product_type: 'Electronics',
          price_min: 150,
          price_max: 300,
        }),
        ProductBuilder.build({
          vendor: 'Apple',
          product_type: 'Accessories',
          price_min: 50,
          price_max: 100,
        }),
      ];

      mockCatalogManager.getAllProducts.mockReturnValue(products);

      const result = productSelector.getCatalogStats();

      expect(result).toEqual({
        total_products: 3,
        vendors: ['Apple', 'Samsung'],
        product_types: ['Electronics', 'Accessories'],
        price_range: {
          min: 50,
          max: 300,
        },
      });
    });

    test('handles empty catalog', () => {
      mockCatalogManager.getAllProducts.mockReturnValue([]);

      const result = productSelector.getCatalogStats();

      expect(result).toEqual({
        total_products: 0,
        vendors: [],
        product_types: [],
        price_range: {
          min: Infinity,
          max: -Infinity,
        },
      });
    });

    test('filters out empty product types', () => {
      const products = [
        ProductBuilder.build({ product_type: 'Electronics' }),
        ProductBuilder.build({ product_type: '' }),
        ProductBuilder.build({ product_type: 'Accessories' }),
      ];

      mockCatalogManager.getAllProducts.mockReturnValue(products);

      const result = productSelector.getCatalogStats();

      expect(result.product_types).toEqual(['Electronics', 'Accessories']);
    });

    test('removes duplicate vendors and product types', () => {
      const products = [
        ProductBuilder.build({ vendor: 'Apple', product_type: 'Electronics' }),
        ProductBuilder.build({ vendor: 'Apple', product_type: 'Electronics' }),
        ProductBuilder.build({
          vendor: 'Samsung',
          product_type: 'Electronics',
        }),
      ];

      mockCatalogManager.getAllProducts.mockReturnValue(products);

      const result = productSelector.getCatalogStats();

      expect(result.vendors).toEqual(['Apple', 'Samsung']);
      expect(result.product_types).toEqual(['Electronics']);
    });
  });
});
