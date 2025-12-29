import { NormalizedProduct, ProductCard, SearchFilters } from '../types';
import { extractFiltersFromQuery } from '../filters';

export const formatPrice = (product: NormalizedProduct): string =>
  product.price_min === product.price_max
    ? `€${product.price_min.toFixed(2)}`
    : `€${product.price_min.toFixed(2)}-${product.price_max.toFixed(2)}`;

export const truncateDescription = (text: string, maxLength = 150): string =>
  text.length > maxLength ? `${text.substring(0, maxLength - 3)}...` : text;

export const formatProductCard = (
  product: NormalizedProduct,
  reason?: string
): ProductCard => ({
  id: product.id,
  title: product.title,
  price: formatPrice(product),
  vendor: product.vendor,
  type: product.product_type || 'Product',
  tags: product.tags.slice(0, 3),
  description: truncateDescription(product.description_text),
  url: product.url,
  image: product.images.length > 0 ? product.images[0].src : undefined,
  reason,
});

export const mergeExtractedFilters = (
  searchFilters: SearchFilters,
  query: string
): void => {
  Object.entries(extractFiltersFromQuery(query)).forEach(([key, value]) => {
    if (
      searchFilters[key as keyof SearchFilters] === undefined &&
      value !== undefined
    ) {
      (searchFilters as Record<string, unknown>)[key] = value;
    }
  });
};

export const getReasonByRank = (index: number): string =>
  index === 0
    ? 'Best match for your query'
    : index < 3
      ? 'Highly relevant'
      : 'Good alternative';

export const calculateTypeScore = (type1: string, type2: string): number =>
  type1 === type2 ? 3 : 0;

export const calculateVendorScore = (v1: string, v2: string): number =>
  v1 === v2 ? 2 : 0;

export const calculateTagScore = (tags1: string[], tags2: string[]): number =>
  tags1.filter(t => tags2.includes(t)).length;

export const calculatePriceScore = (p1: number, p2: number): number => {
  const maxPrice = Math.max(p1, p2);
  return maxPrice > 0 && Math.abs(p1 - p2) / maxPrice < 0.5 ? 1 : 0;
};
