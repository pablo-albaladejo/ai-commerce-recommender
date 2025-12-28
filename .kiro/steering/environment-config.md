---
inclusion: fileMatch
fileMatchPattern: "**/cdk-app.ts,**/stack.ts,**/.env*"
---

# Environment Configuration

## Lambda Environment Variables

### Required

- `CATALOG_BUCKET` — S3 bucket with artifacts
- `CATALOG_PREFIX` — prefix path for artifacts (e.g. `itower/`)
- `TITAN_EMBED_MODEL_ID` — Bedrock embeddings model ID
- `CLAUDE_MODEL_ID` — Bedrock chat model ID
- `AWS_REGION`

### Optional

- `LOG_LEVEL` — `debug|info|warn|error`
- `CACHE_TTL_SECONDS` — artifact refresh window

## Build Script Environment

### Required for Indexing

- `CATALOG_SOURCE_URL` or input file path
- `CATALOG_BUCKET`, `CATALOG_PREFIX`
- Bedrock model IDs for embedding job

## Security Guidelines

- Do not store secrets in repository
- Use AWS Secrets Manager or environment variables
- Validate webhook signatures for Instagram/Meta if added
- Implement rate-limiting if exposed publicly
- Do not collect or store personal data unless explicitly required
