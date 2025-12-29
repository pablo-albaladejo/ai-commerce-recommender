#!/bin/bash

# Telegram Chatbot CDK Deployment Script
# Usage: ./scripts/deploy.sh [environment] [options]

set -e

# Get script directory and change to infra package root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$INFRA_DIR")")"

cd "$INFRA_DIR"

# Load environment variables from .env if it exists
if [ -f "$INFRA_DIR/.env" ]; then
    echo "Loading environment variables from .env..."
    set -a
    source "$INFRA_DIR/.env"
    set +a
fi

# Parse arguments
AUTO_APPROVE=false
ENVIRONMENT="dev"
for arg in "$@"; do
    if [[ "$arg" == "--yes" || "$arg" == "-y" ]]; then
        AUTO_APPROVE=true
    elif [[ "$arg" != -* ]]; then
        ENVIRONMENT="$arg"
    fi
done

# Default values
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
AWS_REGION=${AWS_REGION:-eu-west-1}
AWS_ACCOUNT=${AWS_ACCOUNT:-}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Deploying Telegram Chatbot Infrastructure${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Region: ${AWS_REGION}${NC}"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
    echo -e "${YELLOW}Valid environments: dev, staging, prod${NC}"
    exit 1
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not configured or no valid credentials${NC}"
    echo -e "${YELLOW}Please run 'aws configure' or set AWS credentials${NC}"
    exit 1
fi

# Get AWS account ID if not provided
if [ -z "$AWS_ACCOUNT" ]; then
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
fi

echo -e "${BLUE}Account: ${AWS_ACCOUNT}${NC}"

# Build the project (from project root)
echo -e "${YELLOW}📦 Building project...${NC}"
(cd "$PROJECT_ROOT" && pnpm build)

# Bootstrap CDK if needed
echo -e "${YELLOW}🔧 Checking CDK bootstrap...${NC}"
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $AWS_REGION &> /dev/null; then
    echo -e "${YELLOW}🔧 Bootstrapping CDK...${NC}"
    npx cdk bootstrap aws://$AWS_ACCOUNT/$AWS_REGION
else
    echo -e "${GREEN}✅ CDK already bootstrapped${NC}"
fi

# Prepare CDK context
CDK_CONTEXT=""
if [ ! -z "$TELEGRAM_BOT_TOKEN" ]; then
    CDK_CONTEXT="$CDK_CONTEXT -c telegramBotToken=$TELEGRAM_BOT_TOKEN"
fi

CDK_CONTEXT="$CDK_CONTEXT -c environment=$ENVIRONMENT"
CDK_CONTEXT="$CDK_CONTEXT -c region=$AWS_REGION"
CDK_CONTEXT="$CDK_CONTEXT -c account=$AWS_ACCOUNT"

# Show diff first
echo -e "${YELLOW}📋 Showing deployment diff...${NC}"
npx cdk diff $CDK_CONTEXT telegram-chatbot-$ENVIRONMENT || true

# Ask for confirmation (skip if --yes flag)
if [ "$AUTO_APPROVE" = false ]; then
    echo -e "${YELLOW}❓ Do you want to proceed with deployment? (y/N)${NC}"
    read -r response
    if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo -e "${YELLOW}⏹️  Deployment cancelled${NC}"
        exit 0
    fi
fi

# Deploy
echo -e "${YELLOW}🚀 Deploying stack...${NC}"
npx cdk deploy $CDK_CONTEXT telegram-chatbot-$ENVIRONMENT --require-approval never

# Get outputs
echo -e "${GREEN}✅ Deployment completed!${NC}"
echo -e "${BLUE}📋 Stack outputs:${NC}"

# Extract webhook URL from stack outputs
WEBHOOK_URL=$(aws cloudformation describe-stacks \
    --stack-name telegram-chatbot-$ENVIRONMENT \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`WebhookUrl`].OutputValue' \
    --output text 2>/dev/null || echo "Not available")

if [ "$WEBHOOK_URL" != "Not available" ]; then
    echo -e "${GREEN}🔗 Webhook URL: ${WEBHOOK_URL}${NC}"
    echo -e "${YELLOW}📝 Configure this URL in your Telegram bot settings${NC}"
    
    if [ ! -z "$TELEGRAM_BOT_TOKEN" ]; then
        echo -e "${YELLOW}🤖 Setting Telegram webhook...${NC}"
        curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
            -H "Content-Type: application/json" \
            -d "{\"url\":\"${WEBHOOK_URL}\"}" || true
        echo -e "${GREEN}✅ Telegram webhook configured${NC}"
    fi
else
    echo -e "${RED}❌ Could not retrieve webhook URL${NC}"
fi

echo -e "${GREEN}🎉 Deployment complete!${NC}"