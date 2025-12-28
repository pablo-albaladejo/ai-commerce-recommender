---
inclusion: always
---

# Monorepo Guidelines (pnpm)

## Package Manager
- **Use pnpm**: Fast, efficient, with excellent monorepo support
- **Workspaces**: Defined in `pnpm-workspace.yaml`
- **Package naming**: Use scoped names `@ai-commerce/*`

## Package Structure

### @ai-commerce/core
- **Purpose**: Core business logic and shared utilities
- **Location**: `packages/core/`
- **Dependencies**: AWS SDK clients only
- **Exports**: All shared types, algorithms, and utilities

### @ai-commerce/lambda
- **Purpose**: AWS Lambda handlers and runtime code
- **Location**: `packages/lambda/`
- **Dependencies**: `@ai-commerce/core`, AWS Lambda types
- **Exports**: Lambda handlers for deployment

### @ai-commerce/scripts
- **Purpose**: Build scripts and utilities
- **Location**: `packages/scripts/`
- **Dependencies**: `@ai-commerce/core`, build-specific libraries
- **Exports**: CLI tools and build scripts

### @ai-commerce/infra
- **Purpose**: AWS CDK infrastructure definitions
- **Location**: `packages/infra/`
- **Dependencies**: AWS CDK libraries
- **Exports**: CDK stacks and constructs

## Workspace Dependencies
- **Internal dependencies**: Use `workspace:*` protocol
- **Shared dev dependencies**: Define in root `package.json`
- **Package-specific dependencies**: Define in individual `package.json`

## Build System
- **TypeScript**: Project references for incremental builds
- **Scripts**: Use `pnpm -r` for recursive operations
- **Filtering**: Use `pnpm --filter` for package-specific operations

## Development Workflow
```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Build specific package
pnpm --filter @ai-commerce/core build

# Run tests in all packages
pnpm test

# Run package-specific command
pnpm --filter @ai-commerce/scripts download:sitemap <url> <dir>
```

## Cross-Package Communication
- Import from `@ai-commerce/core` for shared logic
- Avoid circular dependencies between packages
- Keep packages loosely coupled
- Use TypeScript project references for type checking