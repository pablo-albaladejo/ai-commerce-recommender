# @ai-commerce/core

Core business logic for AI commerce recommender, including the Product_Selector component for
LLM-optimized product selection and formatting.

## Features

- **Product_Selector**: Intelligent product selection and formatting for LLM context
- **Catalog Management**: Load and normalize Shopify product data
- **Hybrid Search**: BM25 + semantic similarity with rank fusion
- **Smart Filtering**: Price, vendor, type, tags, and availability filters
- **Token Optimization**: Compact product cards (150-char descriptions, max 3 tags)
- **Query Processing**: Extract filters from natural language queries

## Installation

```bash
pnpm install @ai-commerce/core
```

## Quick Start

```typescript
import { ProductSelector, CatalogManager } from '@ai-commerce/core';

// Load your Shopify catalog data
const catalogData = [...]; // Your Shopify products JSON
const catalogManager = new CatalogManager(catalogData);
const productSelector = new ProductSelector(catalogManager);

// Select top products for LLM context
const result = await productSelector.selectProducts({
  query: 'professional ladder under 500',
  maxResults: 8,
});

console.log(`Found ${result.total_found} products:`);
result.products.forEach(product => {
  console.log(`${product.title} - ${product.price}`);
  console.log(`  ${product.description}`);
  console.log(`  Reason: ${product.reason}`);
});
```

## API Reference

### ProductSelector

Main class for product selection and formatting.

#### Methods

##### `selectProducts(options?)`

Select top products based on query and filters.

```typescript
const result = await productSelector.selectProducts({
  query: 'ladder professional', // Search query (optional)
  filters: { max_price: 500 }, // Filters (optional)
  maxResults: 8, // Max results (default: 10, max: 10)
});
```

**Parameters:**

- `options` (object, optional):
  - `query` (string, optional): Search query string
  - `filters` (SearchFilters, optional): Filter criteria
  - `maxResults` (number, optional): Maximum results (1-10, default: 10)

**Returns:** `ProductSelectionResult`

- `products`: Array of optimized product cards
- `total_found`: Total matching products
- `search_query`: Original search query
- `filters_applied`: Applied filter criteria
- `debug`: Ranking debug information

##### `getProductsByIds(ids)`

Get products by specific IDs.

```typescript
const cards = productSelector.getProductsByIds([1, 2, 3]);
```

##### `getSimilarProducts(productId, limit?)`

Find similar products based on type, vendor, and tags.

```typescript
const similar = productSelector.getSimilarProducts(123, 5);
```

##### `getCatalogStats()`

Get catalog statistics for debugging.

```typescript
const stats = productSelector.getCatalogStats();
console.log(`Total products: ${stats.total_products}`);
console.log(`Vendors: ${stats.vendors.join(', ')}`);
```

### CatalogManager

Manages product catalog loading and normalization.

#### Methods

##### `loadProducts(catalogData)`

Load products from raw Shopify catalog data.

```typescript
const catalogManager = new CatalogManager();
catalogManager.loadProducts(shopifyProductsArray);
```

##### `getAllProducts()`

Get all normalized products.

##### `getProduct(id)`

Get single product by ID.

##### `getProducts(ids)`

Get multiple products by IDs.

##### `searchProducts(query)`

Simple text search across products.

## Product Card Format

Products are formatted into compact cards optimized for LLM context:

```typescript
type ProductCard = {
  id: number;
  title: string;
  price: string; // Formatted price range (currently hard-coded to "€" in core)
  vendor: string;
  type: string;
  tags: string[]; // Limited to 3 most relevant
  description: string; // Truncated to ~150 chars
  url: string;
  image?: string;
  reason?: string; // Why this product was selected
};
```

## Search Filters

```typescript
type SearchFilters = {
  query?: string;
  max_price?: number;
  min_price?: number;
  vendor?: string;
  product_type?: string;
  tags?: string[];
  exclude_tags?: string[];
  available_only?: boolean; // Default: true
  limit?: number; // 1-20, default: 10
};
```

## Query Filter Extraction

The system automatically extracts filters from natural language queries:

- `"ladder under 500"` → `{ max_price: 500 }`
- `"over 100"` → `{ min_price: 100 }`
- `"available ladder"` → `{ available_only: true }`

## Ranking Algorithm

Uses hybrid approach combining:

1. **BM25 scoring** for keyword relevance
2. **Semantic similarity** for related concepts
3. **Reciprocal Rank Fusion (RRF)** to combine rankings
4. **Hard filters** applied after ranking

## Token Optimization

Product cards are optimized for LLM context:

- **Max 8-10 products** per selection
- **Descriptions truncated** to ~150 characters
- **Limited tags** (max 3 most relevant)
- **Formatted prices** for readability
- **Relevance reasoning** included

## Examples

For usage examples, see the unit/integration tests under `src/lib/**`.

## Testing

```bash
pnpm test
```

## Architecture

- **Catalog normalization**: Converts Shopify format to internal schema
- **In-memory search**: Fast BM25 and similarity scoring
- **Filter pipeline**: Efficient product filtering
- **Token optimization**: LLM-friendly formatting
- **Extensible design**: Easy to add new ranking algorithms

## Integration

This package integrates with:

- **@ai-commerce/lambda**: Lambda handlers for API endpoints
- **@ai-commerce/scripts**: Offline indexing and data processing
- **Shopify catalogs**: Direct JSON import support
- **AWS Bedrock**: For semantic embeddings (future enhancement)

## Performance

- **In-memory operations**: Sub-millisecond search for ~500 products
- **In-memory catalog**: Products are held in memory via `CatalogManager`
- **Efficient filtering**: Early filtering reduces ranking overhead
- **Token budget**: Optimized for LLM context windows
