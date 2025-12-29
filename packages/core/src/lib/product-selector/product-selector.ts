import { CatalogManager } from '../catalog/catalog';
import { applyFilters, validateFilters } from '../filters';
import { rankProducts } from '../ranking';
import {
  NormalizedProduct,
  ProductCard,
  ProductSelectionResult,
  SearchFilters,
} from '../types';
import {
  calculatePriceScore,
  calculateTagScore,
  calculateTypeScore,
  calculateVendorScore,
  formatProductCard,
  getReasonByRank,
  mergeExtractedFilters,
} from './product-selector-utils';

export { formatProductCard } from './product-selector-utils';

type SelectProductsOptions = {
  query?: string;
  filters?: Partial<SearchFilters>;
  maxResults?: number;
};
type RankContext = {
  query?: string;
  candidates: NormalizedProduct[];
  searchFilters: SearchFilters;
  filteredCount: number;
};

export class ProductSelector {
  private readonly catalogManager: CatalogManager;
  constructor(catalogManager: CatalogManager) {
    this.catalogManager = catalogManager;
  }

  async selectProducts(
    options: SelectProductsOptions = {}
  ): Promise<ProductSelectionResult> {
    const { searchFilters, candidates, filteredCount } =
      this.prepareSelection(options);
    const { rankedProducts, debug } = this.rankCandidates({
      query: options.query,
      candidates,
      searchFilters,
      filteredCount,
    });
    const productCards = rankedProducts.map((p, i) =>
      formatProductCard(p, options.query ? getReasonByRank(i) : undefined)
    );
    return {
      products: productCards,
      total_found: filteredCount,
      search_query: options.query,
      filters_applied: searchFilters,
      debug,
    };
  }

  private prepareSelection(options: SelectProductsOptions) {
    const { query, filters, maxResults = 10 } = options;
    const searchFilters = validateFilters({
      ...filters,
      query,
      limit: Math.min(maxResults, 10),
    });
    if (query) mergeExtractedFilters(searchFilters, query);
    const candidates = applyFilters(
      this.catalogManager.getAllProducts(),
      searchFilters
    );
    return { searchFilters, candidates, filteredCount: candidates.length };
  }

  private rankCandidates(ctx: RankContext) {
    if (!ctx.query?.trim()) {
      return {
        rankedProducts: ctx.candidates.slice(0, ctx.searchFilters.limit),
        debug: { filtered_count: ctx.filteredCount },
      };
    }
    const topIds = rankProducts(ctx.query, ctx.candidates)
      .scores.slice(0, ctx.searchFilters.limit)
      .map(s => s.id);
    return {
      rankedProducts: this.catalogManager.getProducts(topIds),
      debug: {
        bm25_top: topIds.slice(0, 5),
        semantic_top: topIds.slice(0, 5),
        fused_top: topIds,
        filtered_count: ctx.filteredCount,
      },
    };
  }

  getProductsByIds(ids: number[]): ProductCard[] {
    return this.catalogManager.getProducts(ids).map(p => formatProductCard(p));
  }

  getSimilarProducts(productId: number, limit: number = 5): ProductCard[] {
    const ref = this.catalogManager.getProduct(productId);
    if (!ref) return [];
    return this.catalogManager
      .getAllProducts()
      .filter(p => p.id !== productId)
      .map(p => ({ product: p, similarity: this.calculateSimilarity(p, ref) }))
      .filter(({ similarity }) => similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(({ product }) => formatProductCard(product, 'Similar product'));
  }

  private calculateSimilarity(
    product: NormalizedProduct,
    ref: NormalizedProduct
  ): number {
    return (
      calculateTypeScore(product.product_type, ref.product_type) +
      calculateVendorScore(product.vendor, ref.vendor) +
      calculateTagScore(product.tags, ref.tags) +
      calculatePriceScore(product.price_min, ref.price_min)
    );
  }

  getCatalogStats() {
    const products = this.catalogManager.getAllProducts();
    const prices = products.flatMap(p => [p.price_min, p.price_max]);
    return {
      total_products: products.length,
      vendors: [...new Set(products.map(p => p.vendor))],
      product_types: [...new Set(products.map(p => p.product_type))].filter(
        Boolean
      ),
      price_range: { min: Math.min(...prices), max: Math.max(...prices) },
    };
  }
}
