---
inclusion: always
---

# Architecture Guidelines

## Core Principles

### Cost Optimization

- **NO always-on infrastructure** (OpenSearch, RDS) unless explicitly requested
- Prefer: S3 + Lambda + in-memory indices
- Limit LLM calls to:
  - (optional) constraint extraction
  - final re-ranking + response (top 5–10 candidates only)
- Keep prompts short; avoid sending full product descriptions to the LLM

### Separation of Concerns

- `/src/build/*` - offline indexing only
- `/src/lambda/*` - runtime handlers only
- `/src/lib/*` - shared logic, platform-neutral

### Function Purity

- Retrieval, fusion, filters should be deterministic
- Only `bedrock.ts`, `catalog.ts`, and handler files should do I/O

### Backwards Compatibility

- Changes to normalized schema must be backwards-compatible
- Include migration plan and artifact rebuild step for breaking changes

## Architecture Overview

### Offline Indexing (build-time)

1. Ingest catalog JSON (Shopify or generic)
2. Normalize products into stable schema
3. Build BM25 index from `doc_text`
4. Generate product embeddings (Titan)
5. Upload artifacts to S3

### Online Runtime (per request)

1. Load artifacts from S3 into Lambda memory (cached)
2. Run BM25 + Embedding search
3. Combine ranks with Reciprocal Rank Fusion (RRF)
4. Apply hard filters
5. Call LLM for re-ranking and response crafting

## Technology Stack

- **Hybrid retrieval**: BM25 + Embeddings + RRF
- **Semantic scoring**: Cosine similarity
- **LLM**: AWS Bedrock (Claude Haiku)
- **Embeddings**: AWS Bedrock (Titan Embeddings)
- **Infrastructure**: AWS CDK (TypeScript)
- **Runtime**: AWS Lambda + API Gateway + S3
