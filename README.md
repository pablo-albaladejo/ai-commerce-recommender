# AI Commerce Recommender

A **pnpm monorepo** for building a serverless commerce product recommender chatbot on AWS.

## 🏗️ Architecture

- **Package Manager**: pnpm with workspaces
- **Hybrid Retrieval**: BM25 + Embeddings + Rank Fusion (RRF)
- **LLM**: AWS Bedrock (Claude Haiku)
- **Embeddings**: AWS Bedrock (Titan Embeddings)
- **Infrastructure**: AWS CDK (TypeScript)
- **Runtime**: AWS Lambda + API Gateway + S3

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

# Deploy infrastructure
pnpm cdk:deploy

# Build and upload artifacts
pnpm index:run

# Download products from Shopify sitemap
pnpm download:shopify-sitemap https://example.com/sitemap_products.xml ./data
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
├── examples/               # Example data and configurations
├── docs/                   # Documentation
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

- [Architecture Guidelines](./.kiro/steering/architecture-guidelines.md)
- [Data Schema](./.kiro/steering/data-schema.md)
- [API Contracts](./.kiro/steering/api-contracts.md)
- [Monorepo Guidelines](./.kiro/steering/monorepo-guidelines.md)

## 🤖 Agent Guidelines

This project includes comprehensive steering files for AI agents. See [AGENTS.md](./AGENTS.md) for
detailed guidelines on:

- Architecture principles
- Development workflows
- Testing strategies
- Deployment procedures

## 📄 License

MIT
