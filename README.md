# AI Commerce Recommender (Template)

A **pnpm monorepo template** for building a **serverless Telegram chatbot** on AWS that can
recommend products from a **public Shopify catalog** (no credentials required).

> Current status: the deployed Telegram bot replies with an **acknowledgement message** (mock
> use-case). The actual recommendation logic lives in `@ai-commerce/core` and is meant to be wired
> into the Lambda use-case in a later iteration.

## 🏗️ Architecture

- **Package Manager**: pnpm workspaces (monorepo)
- **Runtime**: AWS Lambda + API Gateway (HTTP API) + DynamoDB
- **Catalog pipeline**: download public Shopify products + build artifacts + (optional) upload to S3
- **Ranking (core)**: BM25-like lexical scoring + heuristic semantic scoring + RRF fusion
- **LLM (optional)**: AWS Bedrock (present as a service wrapper; not used by the current Lambda
  flow)

## 📦 Packages

- **[@ai-commerce/core](./packages/core/)** - Core business logic and shared utilities
- **[@ai-commerce/lambda](./packages/lambda/)** - AWS Lambda handlers
- **[@ai-commerce/scripts](./packages/scripts/)** - Build scripts and utilities
- **[@ai-commerce/infra](./packages/infra/)** - AWS CDK infrastructure

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Deploy infrastructure (Telegram webhook)
# 1) Configure packages/infra/.env from packages/infra/env.example
# 2) Deploy
pnpm cdk:deploy

# Download products from a public Shopify sitemap (no credentials)
pnpm download:shopify-sitemap https://example.com/sitemap_products.xml ./data/<merchant>

# Build local artifacts (normalized catalog + manifest)
CATALOG_INPUT_FILE=./data/<merchant>/shopify-products.json pnpm index:build

# Upload artifacts to S3 (optional; used by future runtime integration)
CATALOG_BUCKET=your-bucket CATALOG_PREFIX=<merchant>/ pnpm index:upload
```

## 📋 Available Scripts

### Global Commands

- `pnpm build` - Build all packages
- `pnpm test` - Run tests in all packages
- `pnpm lint` - Lint all packages
- `pnpm format` - Format all files
- `pnpm clean` - Clean all build artifacts

### Infrastructure

- `pnpm cdk:deploy` - Deploy AWS infrastructure
- `pnpm cdk:diff` - Show infrastructure changes
- `pnpm cdk:destroy` - Destroy AWS infrastructure

### Data Pipeline

- `pnpm index:build` - Build search artifacts locally
- `pnpm index:upload` - Upload artifacts to S3
- `pnpm index:run` - Build and upload artifacts
- `pnpm download:shopify-sitemap <url> <dir>` - Download products from Shopify sitemap

### Package-Specific Commands

```bash
# Build only core package
pnpm --filter @ai-commerce/core build

# Test only lambda package
pnpm --filter @ai-commerce/lambda test

# Run Shopify sitemap downloader
pnpm --filter @ai-commerce/scripts download:shopify-sitemap <url> <dir>
```

## 🏛️ Project Structure

```
/
├── packages/
│   ├── core/               # Core business logic
│   ├── lambda/             # AWS Lambda handlers
│   ├── scripts/            # Build and utility scripts
│   └── infra/              # CDK infrastructure
├── data/                   # Sample downloaded catalogs (local)
├── postman/                # Postman collection for webhook testing
├── pnpm-workspace.yaml     # pnpm workspace configuration
├── package.json            # Root package with workspace scripts
└── tsconfig.json           # Root TypeScript configuration
```

## 🔧 Development

### Adding New Packages

1. Create package directory under `packages/`
2. Add `package.json` with scoped name `@ai-commerce/*`
3. Add TypeScript configuration extending root config
4. Update workspace dependencies as needed

### Cross-Package Dependencies

- Use `workspace:*` for internal dependencies
- Import shared logic from `@ai-commerce/core`
- Avoid circular dependencies

### Testing

- Unit tests for core business logic
- Integration tests for Lambda handlers
- Property-based tests for algorithms

## 📚 Documentation

- **Agent guidance / repo rules**: see `AGENTS.md`
- **Core package docs**: `packages/core/README.md`
- **Infrastructure docs**: `packages/infra/README.md` and `packages/infra/DEPLOYMENT.md`

## 🤖 Agent Guidelines

This project includes comprehensive steering files for AI agents. See [AGENTS.md](./AGENTS.md) for
detailed guidelines on:

- Architecture principles
- Development workflows
- Testing strategies
- Deployment procedures

## 📄 License

MIT
