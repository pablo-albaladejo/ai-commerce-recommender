# AGENTS.md — ai-commerce-recommender

This repository is a **pnpm monorepo** template for building a **serverless commerce product recommender chatbot** on AWS:
- **Package Manager**: pnpm with workspaces
- **Architecture**: Monorepo with multiple packages
- Hybrid retrieval: **BM25 + Embeddings + Rank Fusion (RRF)**
- Semantic scoring: **Cosine similarity**
- LLM: AWS Bedrock (Claude Haiku or similar)
- Embeddings: AWS Bedrock (Titan Embeddings)
- Infra: **AWS CDK (TypeScript)**  
- Runtime: **AWS Lambda + API Gateway (HTTP API) + S3**

The repo is optimized for **low-cost demos** (no always-on DB). With ~500 products, everything runs in-memory.

---

## 1) High-level Architecture

### Offline indexing (build-time)
1. Ingest catalog JSON (Shopify or generic)
2. Normalize products into a stable schema
3. Build BM25 index from `doc_text`
4. Generate product embeddings (Titan)
5. Upload artifacts to S3:
   - `catalog.json`
   - `bm25_index.json` (or equivalent)
   - `embeddings.bin` / `embeddings.json`
   - `id_map.json` (if needed)

### Online runtime (per request)
1. Load artifacts from S3 into Lambda memory (cached across warm invocations)
2. Run:
   - BM25 search (topK)
   - Embedding search (topK, cosine similarity)
3. Combine ranks with Reciprocal Rank Fusion (RRF)
4. Apply hard filters (availability, price, vendor, type, tags)
5. Call LLM to re-rank top candidates and craft a helpful response

---

## 2) Repository Layout (pnpm monorepo)

```
/
├── packages/
│   ├── core/               # @ai-commerce/core - Core business logic
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── bedrock.ts      # Titan embeddings + chat model invocations
│   │   │   │   ├── bm25.ts         # BM25 index build + query
│   │   │   │   ├── cosine.ts       # cosine similarity
│   │   │   │   ├── fusion.ts       # rank fusion (RRF)
│   │   │   │   ├── catalog.ts      # artifact loading from S3 + caching
│   │   │   │   ├── normalize.ts    # raw -> normalized schema
│   │   │   │   ├── types.ts        # shared types
│   │   │   │   ├── filters.ts      # hard filter logic
│   │   │   │   └── prompt.ts       # system prompts + response schema
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── lambda/             # @ai-commerce/lambda - AWS Lambda handlers
│   │   ├── src/
│   │   │   ├── chat-handler.ts     # main HTTP endpoint
│   │   │   ├── telegram-webhook.ts # optional channel adapter
│   │   │   └── instagram-webhook.ts # optional channel adapter
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── scripts/            # @ai-commerce/scripts - Build and utility scripts
│   │   ├── src/
│   │   │   ├── build-index.ts      # offline job: ingest + normalize + BM25 + embeddings
│   │   │   ├── upload-artifacts.ts # upload to S3
│   │   │   ├── download-shopify-sitemap.ts # Shopify sitemap downloader
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── infra/              # @ai-commerce/infra - CDK infrastructure
│       ├── src/
│       │   ├── cdk-app.ts
│       │   └── stack.ts
│       ├── package.json
│       └── tsconfig.json
├── examples/
│   ├── shopify/
│   └── generic-json/
├── docs/
│   ├── architecture.md
│   └── deployment.md
├── pnpm-workspace.yaml
├── package.json            # Root package with workspace scripts
└── tsconfig.json           # Root TypeScript config with project references
```

---

## 3) Ground Rules for Agents

### 3.1 Keep costs low
- Do NOT introduce always-on infrastructure (OpenSearch, RDS) unless explicitly requested.
- Prefer: S3 + Lambda + in-memory indices.
- Limit LLM calls to:
  - (optional) constraint extraction
  - final re-ranking + response (top 5–10 candidates only)
- Keep prompts short; avoid sending full product descriptions to the LLM.

### 3.2 Maintain strict separation of concerns (monorepo)
- `packages/core/src/lib/*` contains shared business logic and should remain platform-neutral.
- `packages/lambda/src/*` contains runtime handlers only.
- `packages/scripts/src/*` is for offline indexing and utility scripts only.
- `packages/infra/src/*` contains CDK infrastructure definitions only.
- Cross-package dependencies should use workspace references (`workspace:*`).

### 3.3 Keep functions pure where possible
- Retrieval, fusion, filters should be deterministic.
- Only `bedrock.ts`, `catalog.ts`, and handler files should do I/O.
- Core business logic in `@ai-commerce/core` should be testable in isolation.

### 3.4 Minimal breaking changes
- Changes to normalized schema must be backwards-compatible or must include a migration plan and artifact rebuild step.

### 3.5 Code Language Standards
- **ALL code must be written in English**: variable names, function names, class names, comments, documentation
- **ALL comments must be in English**: inline comments, JSDoc, README files, code documentation
- This applies regardless of the input language or user's native language
- Use clear, descriptive English names that follow standard conventions

---

## 4) Normalized Product Schema (canonical)

All retrieval and generation operates on this normalized schema (see `packages/core/src/lib/types.ts`):

Required fields:
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
- `doc_text: string`  (used by BM25 & embeddings)

Optional:
- `variants: { sku?: string; price?: number; available?: boolean }[]`
- `attributes: Record<string, any>` (inferred specs: norms, material, load_kg, etc.)
- `embedding?: number[]` (not required in catalog; typically stored separately)

If adding new fields, keep them optional by default.

---

## 5) Retrieval Details

### BM25
- Input: `doc_text`
- Output: ranked list of product IDs

### Embeddings
- Product embeddings are computed offline.
- Query embedding is computed online.
- Similarity: cosine similarity
- Output: ranked list of product IDs

### Rank Fusion (RRF)
- Combine BM25 rank and embedding rank using RRF:
  `score = Σ 1 / (k + rank)`
- Default `k = 60`
- Output: fused ranking

### Hard Filters
Apply after fusion:
- `available_only`
- `max_price`
- `vendor`
- `product_type`
- `include_tags / exclude_tags`

---

## 6) API Contract (Chat)

The main endpoint should remain:

- `POST /chat`
- Input:
```json
{
  "userMessage": "string",
  "conversationState": { "filters": {}, "prefs": {} }
}
```

- Output:
```json
{
  "answer": "string",
  "recommendations": [
    {
      "id": 123,
      "title": "...",
      "url": "...",
      "price": 99.99,
      "image": "https://...",
      "reason": "short"
    }
  ],
  "debug": {
    "bm25Top": [ ... ],
    "semanticTop": [ ... ],
    "fusedTop": [ ... ]
  }
}
```

Notes:
- The output format may evolve, but `answer` + `recommendations` should remain stable.

---

## 7) Environment Variables

Lambda:
- `CATALOG_BUCKET` — S3 bucket with artifacts
- `CATALOG_PREFIX` — prefix path for artifacts (e.g. `itower/`)
- `TITAN_EMBED_MODEL_ID` — Bedrock embeddings model ID
- `CLAUDE_MODEL_ID` — Bedrock chat model ID
- `AWS_REGION`

Optional:
- `LOG_LEVEL` — `debug|info|warn|error`
- `CACHE_TTL_SECONDS` — artifact refresh window

Build script:
- `CATALOG_SOURCE_URL` or input file path
- `CATALOG_BUCKET`, `CATALOG_PREFIX`
- Bedrock model IDs for embedding job

---

## 8) Commands (pnpm monorepo)

The repository provides these scripts in the root `package.json`:

- `pnpm build` - Build all packages
- `pnpm test` - Run tests in all packages
- `pnpm lint` - Lint all packages
- `pnpm format` - Format all files
- `pnpm clean` - Clean all build artifacts
- `pnpm dev` - Start development mode (watch) for all packages
- `pnpm cdk:deploy` - Deploy infrastructure
- `pnpm cdk:diff` - Show infrastructure diff
- `pnpm cdk:destroy` - Destroy infrastructure
- `pnpm index:build` - Build artifacts locally
- `pnpm index:upload` - Upload artifacts to S3
- `pnpm index:run` - Build + upload artifacts
- `pnpm download:shopify-sitemap` - Download products from Shopify sitemap

### Package-specific commands:

- `pnpm --filter @ai-commerce/core build` - Build only core package
- `pnpm --filter @ai-commerce/lambda test` - Test only lambda package
- `pnpm --filter @ai-commerce/scripts download:shopify-sitemap <url> <dir>` - Run Shopify sitemap downloader

If these scripts don’t exist yet, agents should add them.

---

## 9) Development Workflow

### 9.1 Add a new catalog source
1. Implement parser in `packages/core/src/lib/normalize.ts`
2. Ensure normalized output matches canonical schema
3. Update `packages/scripts/src/build-index.ts`
4. Rebuild artifacts and validate retrieval works

### 9.2 Add a new channel adapter (Telegram/Instagram)
1. Create Lambda handler under `packages/lambda/src/*-webhook.ts`
2. Adapter should only translate channel messages ↔ `/chat` API
3. Avoid channel-specific business logic in core

### 9.3 Improve recommendation quality
Preferred order of improvements:
1. Better `doc_text` composition
2. Better hard filters + inferred attributes
3. Add query rewriting / constraint extraction
4. LLM re-ranking improvements (but keep tokens low)

---

## 10) Testing Strategy

Minimum tests:
- Normalize function produces stable schema
- BM25 returns deterministic results
- Cosine + fusion behave as expected
- Filters work and don’t drop all results unexpectedly

Add:
- snapshot tests for normalization
- small fixture catalog in `examples/generic-json`

---

## 11) Security & Compliance

- Do not store secrets in repo.
- Use AWS Secrets Manager or env vars.
- Validate webhook signatures for Instagram/Meta if added.
- Rate-limit if exposed publicly.
- Do not collect or store personal data unless explicitly required.

---

## 12) Agent Expectations

When asked to implement features, agents should:
1. Propose the minimal change set
2. Keep costs low and architecture serverless
3. Add or update tests
4. Update docs if behavior changes
5. Avoid introducing heavy dependencies unless justified
6. **Write ALL code and comments in English** regardless of input language

---

## 13) Quick Start Checklist (for humans)

1. Deploy infra:
   - `pnpm cdk:deploy`
2. Build + upload artifacts:
   - `pnpm index:run`
3. Test endpoint:
   - `curl -X POST <api>/chat -d '{"userMessage":"Need a fiberglass ladder under 600"}'`
4. Optional:
   - Configure Telegram webhook to `/telegram/webhook`

---

## 14) Glossary

- **BM25**: lexical scoring for keyword match
- **Embeddings**: semantic vectors
- **Cosine similarity**: compares embedding vectors
- **RRF**: rank fusion method combining multiple ranked lists
- **Artifacts**: precomputed files stored in S3 and loaded by Lambda

---
