# Telegram Chatbot Deployment Guide

This guide walks you through deploying the Telegram chatbot infrastructure to AWS.

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Node.js 18+** and **pnpm** installed
3. **Telegram Bot Token** from [@BotFather](https://t.me/botfather)

## Quick Deployment

### 1. Install Dependencies

```bash
# From the root of the repository
pnpm install
```

### 2. Build All Packages

```bash
pnpm build
```

### 3. Deploy Infrastructure

```bash
# Set your Telegram bot token
export TELEGRAM_BOT_TOKEN="your_bot_token_here"

# Deploy to development environment
./packages/infra/scripts/deploy.sh dev
```

The deployment script will:

- Bootstrap CDK if needed
- Show a diff of changes
- Ask for confirmation
- Deploy the infrastructure
- Configure the Telegram webhook automatically

### 4. Verify Deployment

After deployment, you should see output like:

```
✅ Deployment completed!
🔗 Webhook URL: https://abc123.execute-api.us-east-1.amazonaws.com/telegram/webhook
🤖 Setting Telegram webhook...
✅ Telegram webhook configured
🎉 Deployment complete!
```

## Manual Deployment

If you prefer manual control:

### 1. Bootstrap CDK (first time only)

```bash
cd packages/infra
pnpm cdk bootstrap
```

### 2. Deploy Stack

```bash
pnpm cdk deploy telegram-chatbot-dev \
  -c environment=dev \
  -c telegramBotToken=your_bot_token
```

### 3. Configure Telegram Webhook

```bash
# Get the webhook URL from stack outputs
WEBHOOK_URL=$(aws cloudformation describe-stacks \
  --stack-name telegram-chatbot-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`WebhookUrl`].OutputValue' \
  --output text)

# Set the webhook
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${WEBHOOK_URL}\"}"
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

You can customize the deployment with CDK context variables:

```bash
pnpm cdk deploy telegram-chatbot-dev \
  -c environment=dev \
  -c telegramBotToken=your_token \
  -c catalogBucket=your-catalog-bucket \
  -c catalogPrefix=your-prefix/ \
  -c embedModel=amazon.titan-embed-text-v1 \
  -c chatModel=anthropic.claude-3-haiku-20240307-v1:0
```

## Monitoring

After deployment, you can monitor the system through:

### CloudWatch Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/telegram-chatbot-webhook-dev --follow
```

### CloudWatch Metrics

- Lambda function metrics (errors, duration, invocations)
- DynamoDB metrics (throttling, consumed capacity)
- Custom business metrics (quotas, budgets)

### CloudWatch Alarms

The stack creates several alarms:

- Lambda function errors
- Lambda function duration
- DynamoDB throttling
- Quota breaches
- Budget breaches

### X-Ray Tracing

View distributed traces in the AWS X-Ray console to debug request flows.

## Testing the Bot

1. **Find your bot** on Telegram using the username you set with @BotFather
2. **Send a message** to test the webhook
3. **Check CloudWatch logs** to see the request processing

Example test message:

```
/start
```

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

4. **Webhook Not Working**
   ```bash
   # Check webhook status
   curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
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

## Cleanup

To remove all resources:

```bash
pnpm cdk destroy telegram-chatbot-dev
```

**Warning**: This will delete all data in DynamoDB tables. Make sure to backup important data first.

## Cost Optimization

The infrastructure is designed for cost efficiency:

- **HTTP API Gateway**: Lower cost than REST API
- **ARM64 Lambda**: Better price/performance ratio
- **Pay-per-request DynamoDB**: No provisioned capacity
- **Reserved concurrency**: Limits Lambda costs (set to 10)
- **TTL on DynamoDB**: Automatic data cleanup

Expected costs for low-moderate usage:

- Lambda: $0.01-$1.00/month
- DynamoDB: $0.01-$0.50/month
- API Gateway: $0.01-$0.25/month
- CloudWatch: $0.01-$0.10/month

**Total**: ~$0.05-$2.00/month for typical usage

## Security

The deployment includes several security features:

- **Least-privilege IAM**: Minimal required permissions
- **Signature validation**: Telegram webhook verification (optional)
- **Rate limiting**: Abuse protection middleware
- **X-Ray tracing**: Request tracking and debugging
- **VPC isolation**: Optional VPC deployment
- **Environment isolation**: Separate stacks per environment

## Next Steps

After successful deployment:

1. **Configure rate limits** in the Lambda environment variables
2. **Set up monitoring alerts** for the CloudWatch alarms
3. **Test the bot functionality** with various message types
4. **Monitor costs** in the AWS Billing console
5. **Scale configuration** based on usage patterns
