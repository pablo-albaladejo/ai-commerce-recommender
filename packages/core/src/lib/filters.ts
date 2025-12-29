import { NormalizedProduct, SearchFilters } from './types';

// ============================================================================
// Filter Predicates
// ============================================================================

const filterByAvailability = (
  products: NormalizedProduct[]
): NormalizedProduct[] => products.filter(product => product.available);

const filterByMinPrice = (
  products: NormalizedProduct[],
  minPrice: number
): NormalizedProduct[] =>
  products.filter(product => product.price_min >= minPrice);

const filterByMaxPrice = (
  products: NormalizedProduct[],
  maxPrice: number
): NormalizedProduct[] =>
  products.filter(product => product.price_max <= maxPrice);

const filterByVendor = (
  products: NormalizedProduct[],
  vendor: string
): NormalizedProduct[] => {
  const vendorLower = vendor.toLowerCase();
  return products.filter(product =>
    product.vendor.toLowerCase().includes(vendorLower)
  );
};

const filterByProductType = (
  products: NormalizedProduct[],
  productType: string
): NormalizedProduct[] => {
  const typeLower = productType.toLowerCase();
  return products.filter(product =>
    product.product_type.toLowerCase().includes(typeLower)
  );
};

const filterByIncludedTags = (
  products: NormalizedProduct[],
  tags: string[]
): NormalizedProduct[] => {
  const requiredTags = tags.map(tag => tag.toLowerCase());
  return products.filter(product => {
    const productTags = product.tags.map(tag => tag.toLowerCase());
    return requiredTags.some(tag =>
      productTags.some(productTag => productTag.includes(tag))
    );
  });
};

const filterByExcludedTags = (
  products: NormalizedProduct[],
  tags: string[]
): NormalizedProduct[] => {
  const excludedTags = tags.map(tag => tag.toLowerCase());
  return products.filter(product => {
    const productTags = product.tags.map(tag => tag.toLowerCase());
    return !excludedTags.some(tag =>
      productTags.some(productTag => productTag.includes(tag))
    );
  });
};

// ============================================================================
// Main Filter Function
// ============================================================================

type FilterFn = (products: NormalizedProduct[]) => NormalizedProduct[];
type FilterConfig = { condition: boolean; filter: FilterFn };

const buildFilterConfigs = (filters: SearchFilters): FilterConfig[] => [
  { condition: !!filters.available_only, filter: filterByAvailability },
  {
    condition: filters.min_price !== undefined,
    filter: p => filterByMinPrice(p, filters.min_price!),
  },
  {
    condition: filters.max_price !== undefined,
    filter: p => filterByMaxPrice(p, filters.max_price!),
  },
  {
    condition: !!filters.vendor,
    filter: p => filterByVendor(p, filters.vendor!),
  },
  {
    condition: !!filters.product_type,
    filter: p => filterByProductType(p, filters.product_type!),
  },
  {
    condition: !!filters.tags?.length,
    filter: p => filterByIncludedTags(p, filters.tags!),
  },
  {
    condition: !!filters.exclude_tags?.length,
    filter: p => filterByExcludedTags(p, filters.exclude_tags!),
  },
];

/**
 * Apply filters to a list of products
 */
export const applyFilters = (
  products: NormalizedProduct[],
  filters: SearchFilters
): NormalizedProduct[] =>
  buildFilterConfigs(filters)
    .filter(c => c.condition)
    .reduce((p, c) => c.filter(p), [...products]);

// ============================================================================
// Query Filter Extraction Helpers
// ============================================================================

const PRODUCT_TYPES = [
  'ladder',
  'escalera',
  'plataforma',
  'platform',
  'elevadora',
  'tool',
  'herramienta',
  'equipment',
  'equipo',
];

const extractMaxPriceFromQuery = (queryLower: string): number | undefined => {
  const match = queryLower.match(/(?:under|below|less than|<)\s*(\d+)/);
  return match ? parseInt(match[1]) : undefined;
};

const extractMinPriceFromQuery = (queryLower: string): number | undefined => {
  const match = queryLower.match(/(?:over|above|more than|>)\s*(\d+)/);
  return match ? parseInt(match[1]) : undefined;
};

const extractProductTypeFromQuery = (queryLower: string): string | undefined =>
  PRODUCT_TYPES.find(type => queryLower.includes(type));

const extractAvailabilityFromQuery = (queryLower: string): boolean =>
  queryLower.includes('available') || queryLower.includes('in stock');

/**
 * Extract potential filters from a search query
 */
export const extractFiltersFromQuery = (
  query: string
): Partial<SearchFilters> => {
  const queryLower = query.toLowerCase();

  return {
    max_price: extractMaxPriceFromQuery(queryLower),
    min_price: extractMinPriceFromQuery(queryLower),
    product_type: extractProductTypeFromQuery(queryLower),
    available_only: extractAvailabilityFromQuery(queryLower) || undefined,
  };
};

// ============================================================================
// Filter Validation
// ============================================================================

const DEFAULT_FILTERS: SearchFilters = {
  available_only: true,
  limit: 10,
};

const sanitizeLimit = (limit?: number): number =>
  Math.min(Math.max(limit || 10, 1), 20);

const sanitizePrice = (price?: number): number | undefined =>
  price && price > 0 ? price : undefined;

/**
 * Validate and sanitize search filters
 */
export const validateFilters = (
  filters: Partial<SearchFilters>
): SearchFilters => ({
  ...DEFAULT_FILTERS,
  ...filters,
  limit: sanitizeLimit(filters.limit),
  min_price: sanitizePrice(filters.min_price),
  max_price: sanitizePrice(filters.max_price),
});
