import { z } from 'zod';

// Shopify Product Schema (based on existing data structure)
export const ShopifyProductSchema = z.object({
  id: z.number(),
  title: z.string(),
  body_html: z.string().optional(),
  vendor: z.string(),
  product_type: z.string(),
  created_at: z.string(),
  handle: z.string(),
  updated_at: z.string(),
  published_at: z.string().optional(),
  tags: z.string(),
  variants: z.array(
    z.object({
      id: z.number(),
      product_id: z.number(),
      title: z.string(),
      price: z.string(),
      sku: z.string().optional(),
      position: z.number(),
      compare_at_price: z.string().nullable().optional(),
      fulfillment_service: z.string().optional(),
      inventory_management: z.string().optional(),
      option1: z.string().nullable().optional(),
      option2: z.string().nullable().optional(),
      option3: z.string().nullable().optional(),
      created_at: z.string(),
      updated_at: z.string(),
      taxable: z.boolean().optional(),
      barcode: z.string().optional(),
      grams: z.number().optional(),
      image_id: z.number().nullable().optional(),
      weight: z.number().optional(),
      weight_unit: z.string().optional(),
      requires_shipping: z.boolean().optional(),
      price_currency: z.string().optional(),
      compare_at_price_currency: z.string().optional(),
    })
  ),
  images: z
    .array(
      z.object({
        id: z.number(),
        product_id: z.number(),
        position: z.number(),
        created_at: z.string(),
        updated_at: z.string(),
        alt: z.string().nullable().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        src: z.string(),
        variant_ids: z.array(z.number()).optional(),
      })
    )
    .optional(),
});

export type ShopifyProduct = z.infer<typeof ShopifyProductSchema>;

// Normalized Product Schema for internal use
export const NormalizedProductSchema = z.object({
  id: z.number(),
  title: z.string(),
  url: z.string(),
  vendor: z.string(),
  product_type: z.string(),
  tags: z.array(z.string()),
  available: z.boolean(),
  price_min: z.number(),
  price_max: z.number(),
  images: z.array(
    z.object({
      src: z.string(),
      alt: z.string().optional(),
    })
  ),
  description_text: z.string(),
  doc_text: z.string(), // Used for BM25 & embeddings
  variants: z
    .array(
      z.object({
        sku: z.string().optional(),
        price: z.number(),
        available: z.boolean(),
        title: z.string().optional(),
      })
    )
    .optional(),
  attributes: z.record(z.any()).optional(), // Inferred specs
  embedding: z.array(z.number()).optional(), // Not required in catalog
});

export type NormalizedProduct = z.infer<typeof NormalizedProductSchema>;

// Product Card for LLM Context (optimized for token efficiency)
export const ProductCardSchema = z.object({
  id: z.number(),
  title: z.string(),
  price: z.string(), // Formatted price range
  vendor: z.string(),
  type: z.string(),
  tags: z.array(z.string()),
  description: z.string(), // Truncated description (max 150 chars)
  url: z.string(),
  image: z.string().optional(),
  reason: z.string().optional(), // Why this product was selected
});

export type ProductCard = z.infer<typeof ProductCardSchema>;

// Search and Filter Types
export const SearchFiltersSchema = z.object({
  query: z.string().optional(),
  max_price: z.number().optional(),
  min_price: z.number().optional(),
  vendor: z.string().optional(),
  product_type: z.string().optional(),
  tags: z.array(z.string()).optional(),
  exclude_tags: z.array(z.string()).optional(),
  available_only: z.boolean().default(true),
  limit: z.number().min(1).max(20).default(10),
});

export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

// Product Selection Result
export const ProductSelectionResultSchema = z.object({
  products: z.array(ProductCardSchema),
  total_found: z.number(),
  search_query: z.string().optional(),
  filters_applied: SearchFiltersSchema.optional(),
  debug: z
    .object({
      bm25_top: z.array(z.number()).optional(),
      semantic_top: z.array(z.number()).optional(),
      fused_top: z.array(z.number()).optional(),
      filtered_count: z.number().optional(),
    })
    .optional(),
});

export type ProductSelectionResult = z.infer<
  typeof ProductSelectionResultSchema
>;

// Ranking and Scoring Types
export type ProductScore = {
  id: number;
  score: number;
  rank: number;
  source: 'bm25' | 'semantic' | 'fused' | 'filtered';
};

export type RankingResult = {
  scores: ProductScore[];
  total_candidates: number;
  algorithm_used: string;
};
