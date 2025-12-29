import {
  NormalizedProduct,
  ShopifyProduct,
  ShopifyProductSchema,
} from '../types';

// ============================================================================
// Normalization Helpers
// ============================================================================

const parseTags = (tags?: string): string[] =>
  tags
    ? tags
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean)
    : [];

const extractPriceRange = (variants: ShopifyProduct['variants']) => {
  const prices = variants.map(v => parseFloat(v.price));
  return { min: Math.min(...prices), max: Math.max(...prices) };
};

const extractDescriptionText = (html?: string): string =>
  html
    ? html
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    : '';

type DocTextInput = {
  product: ShopifyProduct;
  description: string;
  tags: string[];
};

const buildDocText = (input: DocTextInput): string =>
  [
    input.product.title,
    input.description,
    input.product.vendor,
    input.product.product_type,
    input.tags.join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const normalizeImages = (images?: ShopifyProduct['images']) =>
  images?.map(img => ({ src: img.src, alt: img.alt || undefined })) || [];

const normalizeVariants = (variants: ShopifyProduct['variants']) =>
  variants.map(v => ({
    sku: v.sku || undefined,
    price: parseFloat(v.price),
    available: true,
    title: v.title || undefined,
  }));

/**
 * Normalizes Shopify product data into our internal format
 */
export const normalizeShopifyProduct = (
  shopifyProduct: ShopifyProduct
): NormalizedProduct => {
  const tags = parseTags(shopifyProduct.tags);
  const priceRange = extractPriceRange(shopifyProduct.variants);
  const description_text = extractDescriptionText(shopifyProduct.body_html);

  return {
    id: shopifyProduct.id,
    title: shopifyProduct.title,
    url: `/products/${shopifyProduct.handle}`,
    vendor: shopifyProduct.vendor,
    product_type: shopifyProduct.product_type,
    tags,
    available: shopifyProduct.variants.length > 0,
    price_min: priceRange.min,
    price_max: priceRange.max,
    images: normalizeImages(shopifyProduct.images),
    description_text,
    doc_text: buildDocText({
      product: shopifyProduct,
      description: description_text,
      tags,
    }),
    variants: normalizeVariants(shopifyProduct.variants),
  };
};

/**
 * Loads and normalizes product catalog from JSON data
 */
export const loadCatalog = (catalogData: unknown[]): NormalizedProduct[] =>
  catalogData.reduce<NormalizedProduct[]>((products, item) => {
    const result = ShopifyProductSchema.safeParse(item);
    if (result.success) {
      products.push(normalizeShopifyProduct(result.data));
    }
    return products;
  }, []);

/**
 * Simple in-memory catalog manager
 */
export class CatalogManager {
  private products: NormalizedProduct[] = [];
  private readonly productMap: Map<number, NormalizedProduct> = new Map();

  constructor(catalogData?: unknown[]) {
    if (catalogData) {
      this.loadProducts(catalogData);
    }
  }

  /**
   * Load products from raw catalog data
   */
  loadProducts(catalogData: unknown[]): void {
    this.products = loadCatalog(catalogData);
    this.productMap.clear();

    // Build product map for fast lookups
    for (const product of this.products) {
      this.productMap.set(product.id, product);
    }
  }

  /**
   * Get all products
   */
  getAllProducts(): NormalizedProduct[] {
    return [...this.products];
  }

  /**
   * Get product by ID
   */
  getProduct(id: number): NormalizedProduct | undefined {
    return this.productMap.get(id);
  }

  /**
   * Get products by IDs
   */
  getProducts(ids: number[]): NormalizedProduct[] {
    return ids
      .map(id => this.productMap.get(id))
      .filter((product): product is NormalizedProduct => product !== undefined);
  }

  /**
   * Get total product count
   */
  getProductCount(): number {
    return this.products.length;
  }

  /**
   * Search products by text (simple text matching)
   */
  searchProducts(query: string): NormalizedProduct[] {
    const searchTerm = query.toLowerCase();

    return this.products.filter(product =>
      product.doc_text.includes(searchTerm)
    );
  }
}
