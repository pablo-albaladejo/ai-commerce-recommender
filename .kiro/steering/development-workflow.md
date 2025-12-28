---
inclusion: always
---

# Development Workflow

## Required NPM Scripts

Ensure these scripts exist in `package.json`:

- `npm run build`
- `npm run test`
- `npm run lint`
- `npm run format`
- `npm run cdk:deploy`
- `npm run cdk:diff`
- `npm run cdk:destroy`
- `npm run index:build` (build artifacts locally)
- `npm run index:upload` (upload artifacts to S3)
- `npm run index:run` (build + upload)

## Common Development Tasks

### Adding New Catalog Source

1. Implement parser in `/src/lib/normalize.ts`
2. Ensure normalized output matches canonical schema
3. Update `/src/build/build-index.ts`
4. Rebuild artifacts and validate retrieval works

### Adding New Channel Adapter

1. Create Lambda handler under `/src/lambda/*-webhook.ts`
2. Adapter should only translate channel messages ↔ `/chat` API
3. Avoid channel-specific business logic in core

### Improving Recommendation Quality

**Preferred order of improvements:**

1. Better `doc_text` composition
2. Better hard filters + inferred attributes
3. Add query rewriting / constraint extraction
4. LLM re-ranking improvements (but keep tokens low)

## Testing Requirements

### Minimum Tests

- Normalize function produces stable schema
- BM25 returns deterministic results
- Cosine + fusion behave as expected
- Filters work and don't drop all results unexpectedly

### Recommended Tests

- Snapshot tests for normalization
- Small fixture catalog in `/examples/generic-json`
- Integration tests for full retrieval pipeline

## Agent Implementation Guidelines

When implementing features, agents should:

1. Propose minimal change set
2. Keep costs low and architecture serverless
3. Add or update tests
4. Update docs if behavior changes
5. Avoid introducing heavy dependencies unless justified
