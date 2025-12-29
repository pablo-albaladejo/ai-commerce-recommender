# Telegram Chatbot Infrastructure

This package contains the AWS CDK infrastructure for the Telegram chatbot application.

## Architecture

The infrastructure includes:

- **AWS Lambda Function**: Handles Telegram webhook requests with Powertools observability
- **HTTP API Gateway**: Cost-effective API endpoint for webhook
- **DynamoDB Tables**:
  - Quotas table for rate limiting
  - Budgets table for cost control
  - Conversation context table for chat history
- **CloudWatch Alarms**: Monitoring for errors, performance, and quota breaches
- **IAM Roles**: Least-privilege permissions for Lambda execution

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Node.js 18+** and **pnpm** installed
3. **AWS CDK** bootstrapped in your target region
4. **Telegram Bot Token** (optional, can be set later)

## Quick Start

### 1. Build the project

```bash
pnpm build
```

### 2. Deploy to development environment

```bash
# Using the deployment script (recommended)
TELEGRAM_BOT_TOKEN=your_bot_token ./scripts/deploy.sh dev

# Or using CDK directly
pnpm cdk deploy telegram-chatbot-dev \
  -c environment=dev \
  -c telegramBotToken=your_bot_token
```

### 3. Configure Telegram webhook

The deployment will output a webhook URL. Configure it in your Telegram bot:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"<WEBHOOK_URL>"}'
```

## Environment Configuration

### Development

```bash
./scripts/deploy.sh dev
```

### Staging

```bash
./scripts/deploy.sh staging
```

### Production

```bash
./scripts/deploy.sh prod
```

## Configuration Options

You can customize the deployment using CDK context:

```bash
pnpm cdk deploy telegram-chatbot-dev \
  -c environment=dev \
  -c telegramBotToken=your_token \
  -c catalogBucket=your-catalog-bucket \
  -c catalogPrefix=your-prefix/ \
  -c embedModel=amazon.titan-embed-text-v1 \
  -c chatModel=anthropic.claude-3-haiku-20240307-v1:0
```

## DynamoDB Tables

### Quotas Table

- **Partition Key**: `userId` (string)
- **Sort Key**: `quotaType` (string)
- **TTL**: Automatic cleanup of expired quotas
- **GSI**: `QuotaTypeIndex` for querying by quota type

### Budgets Table

- **Partition Key**: `userId` (string)
- **Sort Key**: `budgetPeriod` (string)
- **TTL**: Automatic cleanup of expired budgets
- **GSI**: `BudgetPeriodIndex` for querying by period

### Conversation Context Table

- **Partition Key**: `chatId` (string)
- **Sort Key**: `messageId` (string)
- **TTL**: Automatic cleanup of old conversations
- **GSI**: `ChatIdTimestampIndex` for querying recent messages

## Environment Variables

The Lambda function is configured with these environment variables:

### Powertools Configuration

- `POWERTOOLS_SERVICE_NAME`: Service name for observability
- `POWERTOOLS_METRICS_NAMESPACE`: CloudWatch metrics namespace
- `POWERTOOLS_LOGGER_LOG_EVENT`: Whether to log events
- `POWERTOOLS_TRACER_CAPTURE_RESPONSE`: Capture response in traces

### Application Configuration

- `LOG_LEVEL`: Logging level (INFO, DEBUG, WARN, ERROR)
- `ENVIRONMENT`: Deployment environment
- `QUOTAS_TABLE_NAME`: DynamoDB quotas table name
- `BUDGETS_TABLE_NAME`: DynamoDB budgets table name
- `CONVERSATION_CONTEXT_TABLE_NAME`: DynamoDB context table name

### External Services

- `TELEGRAM_BOT_TOKEN`: Telegram bot authentication token
- `CATALOG_BUCKET`: S3 bucket for product catalog
- `CATALOG_PREFIX`: S3 prefix for catalog files
- `TITAN_EMBED_MODEL_ID`: Bedrock embedding model
- `CLAUDE_MODEL_ID`: Bedrock chat model

## CloudWatch Alarms

The stack creates several alarms for monitoring:

- **Lambda Errors**: Triggers on high error rate
- **Lambda Duration**: Triggers on high execution time
- **DynamoDB Throttling**: Monitors table throttling
- **Quota Breaches**: Tracks quota violations
- **Budget Breaches**: Tracks budget violations

## Cost Optimization

The infrastructure is designed for cost efficiency:

- **HTTP API Gateway**: Lower cost than REST API
- **ARM64 Lambda**: Better price/performance ratio
- **Pay-per-request DynamoDB**: No provisioned capacity
- **Reserved concurrency**: Limits Lambda costs
- **TTL on DynamoDB**: Automatic data cleanup

## Security

Security features include:

- **Least-privilege IAM**: Minimal required permissions
- **VPC isolation**: Optional VPC deployment
- **Signature validation**: Telegram webhook verification
- **Rate limiting**: Abuse protection middleware
- **X-Ray tracing**: Request tracking and debugging

## Monitoring and Observability

Built-in observability with AWS Powertools:

- **Structured logging**: JSON logs with correlation IDs
- **Distributed tracing**: X-Ray integration
- **Custom metrics**: Business and performance metrics
- **CloudWatch dashboards**: Automatic metric visualization

## Troubleshooting

### Common Issues

1. **CDK Bootstrap Required**

   ```bash
   pnpm cdk bootstrap aws://ACCOUNT/REGION
   ```

2. **Lambda Build Errors**

   ```bash
   # Ensure Lambda package is built
   pnpm --filter @ai-commerce/lambda build
   ```

3. **Permission Errors**
   ```bash
   # Check AWS credentials
   aws sts get-caller-identity
   ```

### Useful Commands

```bash
# Show stack diff
pnpm cdk diff telegram-chatbot-dev

# View stack outputs
aws cloudformation describe-stacks \
  --stack-name telegram-chatbot-dev \
  --query 'Stacks[0].Outputs'

# Check Lambda logs
aws logs tail /aws/lambda/telegram-chatbot-webhook-dev --follow

# Test webhook endpoint
curl -X POST <WEBHOOK_URL> \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## Development

### Local Development

```bash
# Watch for changes
pnpm cdk watch telegram-chatbot-dev

# Synthesize CloudFormation
pnpm cdk synth telegram-chatbot-dev
```

### Testing

```bash
# Run infrastructure tests
pnpm test

# Validate CDK app
pnpm cdk doctor
```

## Cleanup

To remove all resources:

```bash
pnpm cdk destroy telegram-chatbot-dev
```

**Warning**: This will delete all data in DynamoDB tables. Make sure to backup important data first.
