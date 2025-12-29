# AGENTS.md — ai-commerce-recommender

This repository is a **pnpm monorepo template** for building a **serverless Telegram chatbot** on
AWS that can recommend products from a **public Shopify catalog** (no credentials required).

## 0) Current status (important)

- **Deployed entrypoint**: `POST /telegram/webhook` (API Gateway HTTP API → Lambda)
- **Message processing**: `packages/lambda/src/application/use-cases/process-chat-message.ts` is
  intentionally a **mock** (acknowledgement only). Do not implement recommendation logic unless
  explicitly requested.
- **Recommendation building blocks**: live in `@ai-commerce/core` (catalog normalization, filters,
  ranking, product cards). They are not wired into the Lambda flow yet.
- **Catalog pipeline scripts** exist (download → build artifacts → upload to S3), primarily to make
  onboarding a new fork/customer repeatable.

## 1) High-level architecture

### Offline (CLI / build-time)

1. **Download** public Shopify products via sitemap:
   - `pnpm download:shopify-sitemap <sitemap_products.xml> <output-dir>`
2. **Build artifacts** locally:
   - `pnpm index:build` (requires `CATALOG_INPUT_FILE`)
   - Outputs:
     - `artifacts/catalog.json` (normalized products)
     - `artifacts/shopify-products.json` (raw downloaded products)
     - `artifacts/manifest.json`
3. **Upload artifacts** (optional):
   - `pnpm index:upload` (requires `CATALOG_BUCKET`, optional `CATALOG_PREFIX`)

### Online (per request)

1. Receive Telegram webhook update
2. Parse + validate event schema
3. Validate webhook signature (optional; required in `prod`)
4. Apply abuse protection (rate limit + quota + token budget)
5. Load conversation context (DynamoDB)
6. Execute `processChatMessage` (mock) and send the Telegram message

Planned: integrate `ProductSelector` and (optionally) Bedrock for richer replies.

## 2) Repository layout (current)

```
/
├── packages/
│   ├── core/                         # @ai-commerce/core - platform-neutral business logic
│   │   └── src/lib/
│   │       ├── bedrock-service/      # Bedrock wrapper (optional)
│   │       ├── catalog/             # Shopify normalization + catalog manager
│   │       ├── product-selector/    # product cards + selection utilities
│   │       ├── filters.ts
│   │       ├── ranking.ts
│   │       └── types.ts
│   ├── lambda/                       # @ai-commerce/lambda - runtime handlers only
│   │   └── src/
│   │       ├── handlers/telegram/telegram-webhook.ts
│   │       ├── middleware/           # abuse protection, i18n, tracing, error handler
│   │       └── infrastructure/       # DynamoDB repos, Telegram client, etc.
│   ├── scripts/                      # @ai-commerce/scripts - CLI utilities (no barrel files)
│   │   └── src/
│   │       ├── download-shopify-sitemap.ts
│   │       ├── build-index.ts
│   │       └── upload-artifacts.ts
│   └── infra/                        # @ai-commerce/infra - AWS CDK
│       └── src/stacks/telegram-chatbot-stack.ts
├── data/                             # sample local catalogs (not production artifacts)
└── postman/                          # webhook testing collection
```

## 3) Ground rules for agents

- **Minimal change set**: don’t over-engineer.
- **Keep costs low**: no always-on infrastructure unless explicitly requested.
- **Write all code + docs in English**.
- **Separation of concerns**:
  - `@ai-commerce/core` is platform-neutral and should be testable in isolation.
  - `@ai-commerce/lambda` is glue code + middleware; avoid business logic here.
  - `@ai-commerce/scripts` is for offline CLI utilities only.
  - `@ai-commerce/infra` is CDK only.
- **Error handling**: let errors **bubble** into the existing middleware error handler unless
  explicitly asked to handle them locally.
- **Avoid heavy dependencies** unless clearly justified.

## 4) Normalized product schema (canonical)

All ranking operates on the normalized schema in `packages/core/src/lib/types.ts`:

- Required: `id`, `title`, `url`, `vendor`, `product_type`, `tags`, `available`, `price_min`,
  `price_max`, `images`, `description_text`, `doc_text`
- Optional: `variants`, `attributes`, `embedding`

If adding new fields, keep them **optional** by default.

## 5) Commands

Root scripts:

- `pnpm build` / `pnpm test` / `pnpm lint`
- `pnpm cdk:deploy` / `pnpm cdk:diff` / `pnpm cdk:destroy`
- `pnpm download:shopify-sitemap`
- `pnpm index:build` / `pnpm index:upload` / `pnpm index:run`

## 6) Configuration (env vars)

### Infra deployment (`packages/infra`)

The deploy script reads `packages/infra/.env` (copy from `packages/infra/env.example`).

- `TELEGRAM_BOT_TOKEN` (required to send Telegram replies)
- `TELEGRAM_SECRET_TOKEN` (recommended; required in `prod` for signature validation)
- `AWS_REGION` / `AWS_ACCOUNT` (optional)

### Scripts (`packages/scripts`)

- `CATALOG_INPUT_FILE` (required for `pnpm index:build`)
- `CATALOG_BUCKET` + `CATALOG_PREFIX` (required for `pnpm index:upload`)

## 7) Testing

- `@ai-commerce/core`: unit + integration tests for normalization, ranking, selector
- `@ai-commerce/lambda`: middleware + handler tests
- `@ai-commerce/infra`: CDK assertion tests
