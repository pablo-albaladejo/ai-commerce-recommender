---
inclusion: fileMatch
fileMatchPattern: "**/types.ts"
---

# Normalized Product Schema

All retrieval and generation operates on this normalized schema (see `/src/lib/types.ts`):

## Required Fields

- `id: number`
- `title: string`
- `url: string`
- `vendor: string`
- `product_type: string`
- `tags: string[]`
- `available: boolean`
- `price_min: number`
- `price_max: number`
- `images: { src: string }[]`
- `description_text: string`
- `doc_text: string` (used by BM25 & embeddings)

## Optional Fields

- `variants: { sku?: string; price?: number; available?: boolean }[]`
- `attributes: Record<string, any>` (inferred specs: norms, material, load_kg, etc.)
- `embedding?: number[]` (not required in catalog; typically stored separately)

## Schema Evolution Rules

- New fields must be optional by default
- Breaking changes require migration plan
- Maintain backwards compatibility
- Update normalization functions when schema changes
