// Export main classes for external consumption
export { BedrockService } from './lib/bedrock-service/bedrock-service';
export { CatalogManager } from './lib/catalog/catalog';
export { ProductSelector } from './lib/product-selector/product-selector';

// Export key functions
export { applyFilters } from './lib/filters';
export { rankProducts } from './lib/ranking';

// Export types for external consumption
export type {
  NormalizedProduct,
  ProductCard,
  ProductScore,
  ProductSelectionResult,
  RankingResult,
  SearchFilters,
  ShopifyProduct,
} from './lib/types';

// Export schemas for external consumption
export {
  NormalizedProductSchema,
  ProductCardSchema,
  ProductSelectionResultSchema,
  SearchFiltersSchema,
  ShopifyProductSchema,
} from './lib/types';
