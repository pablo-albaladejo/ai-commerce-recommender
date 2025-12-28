---
inclusion: fileMatch
fileMatchPattern: "**/bm25.ts,**/cosine.ts,**/fusion.ts"
---

# Retrieval Algorithm Details

## BM25 Search

- **Input**: `doc_text` field from normalized products
- **Output**: ranked list of product IDs
- **Implementation**: Deterministic, pure function

## Embedding Search

- **Product embeddings**: computed offline, stored separately
- **Query embedding**: computed online via Bedrock Titan
- **Similarity**: cosine similarity
- **Output**: ranked list of product IDs

## Rank Fusion (RRF)

- **Algorithm**: Reciprocal Rank Fusion
- **Formula**: `score = Σ 1 / (k + rank)`
- **Default k**: 60
- **Input**: BM25 rank + embedding rank
- **Output**: fused ranking

## Hard Filters

Apply after fusion, before LLM re-ranking:

- `available_only`
- `max_price`
- `vendor`
- `product_type`
- `include_tags / exclude_tags`

## Quality Improvement Priority

1. Better `doc_text` composition
2. Better hard filters + inferred attributes
3. Add query rewriting / constraint extraction
4. LLM re-ranking improvements (keep tokens low)
