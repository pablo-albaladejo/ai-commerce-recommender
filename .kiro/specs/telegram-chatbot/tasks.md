# Implementation Plan: Telegram Chatbot Integration

## Overview

This implementation plan converts the Telegram chatbot design into discrete coding tasks. Each task builds incrementally on previous work, following the established monorepo architecture with AWS Lambda Powertools, Middy middleware, and Zod validation. All storage uses DynamoDB to maintain serverless, cost-effective architecture.

## Tasks

- [ ] 1. Set up project dependencies and core types
  - Add required dependencies to packages/lambda/package.json
  - Create shared types for Telegram integration (Telegram_Bot, Update_Object, etc.)
  - Set up Zod schemas for Telegram webhook data
  - Define types for all quota and budget management components
  - _Requirements: All requirements (foundational setup)_

- [ ] 2. Implement custom Zod parser middleware (Message_Validator)
  - Create custom parser middleware for Middy + Zod integration
  - Implement ValidationError class with detailed error handling
  - Add Powertools integration for observability
  - Validate and process incoming message content
  - _Requirements: Data validation and message processing_

- [ ] 3. Implement Telegram webhook signature validation
  - Create signature validation middleware with HMAC-SHA256
  - Add Powertools tracing and metrics for security events
  - Implement proper error responses for invalid signatures
  - _Requirements: Security and authentication_

- [ ] 4. Implement Rate_Limiter component with DynamoDB
  - Create rate limiting middleware with user-based limits (e.g., 10 requests/minute per user)
  - Use DynamoDB with chat_id as partition key and TTL for auto-expiring counters
  - Implement atomic counters with conditional updates to avoid race conditions
  - Add configurable limits via environment variables
  - Add Powertools metrics for rate limit violations and usage patterns
  - Return appropriate HTTP 429 responses when limits exceeded
  - _Requirements: API protection and abuse prevention (Requirement 10.8, 10.10)_

- [ ] 5. Implement Daily_Quota_Manager component with DynamoDB
  - Create daily message quota tracking per user using DynamoDB
  - Use composite key: userId#date for partition key
  - Implement TTL for automatic cleanup after quota period
  - Add quota reset logic at midnight UTC
  - Add configurable daily limits per user (e.g., 50 messages/day)
  - Use DynamoDB atomic counters for thread-safe quota tracking
  - Add Powertools metrics for quota usage and violations
  - Return appropriate responses when daily quota exceeded
  - _Requirements: Daily message quota management (Requirement 10.1, 10.2)_

- [ ] 6. Implement Token_Budget_Manager component with DynamoDB
  - Create daily token usage tracking per user using DynamoDB
  - Track input and output tokens from LLM calls
  - Use composite key: userId#date for partition key with TTL
  - Add configurable daily token limits (e.g., 10,000 tokens/day per user)
  - Add budget reset logic at midnight UTC using TTL
  - Use DynamoDB atomic operations for token counting
  - Add Powertools metrics for token usage patterns
  - Prevent LLM calls when budget exceeded
  - _Requirements: Daily token budget management (Requirement 10.3, 10.4)_

- [ ] 7. Implement Context_Manager component with DynamoDB
  - Create conversation history management per user using DynamoDB
  - Store last 6 user/assistant messages plus compact summary (Requirement 10.6)
  - Use userId#chatId as partition key with TTL for cleanup
  - Implement context window management and token counting
  - Add context compression when approaching token limits
  - Optimize context for LLM processing efficiency
  - Add automatic cleanup for inactive conversations using TTL
  - _Requirements: Conversation history management (Requirement 10.6)_

- [ ] 8. Implement Product_Selector component
  - Create product selection logic for LLM context
  - Pass only top 8-10 candidates with short cards (max 250-300 chars each)
  - Implement product filtering and ranking algorithms
  - Add product data formatting for LLM consumption
  - Optimize product metadata for token efficiency
  - Integrate with existing @ai-commerce/core catalog
  - _Requirements: Product selection and formatting (Requirement 10.7)_

- [ ] 9. Implement Response_Manager component
  - Create LLM response generation with limits
  - Implement response length limits and truncation
  - Add response quality validation
  - Implement fallback responses for LLM failures
  - Track response generation metrics with Powertools
  - Optimize for cost-effective LLM usage
  - _Requirements: LLM response management and limits_

- [ ] 10. Create core Webhook_Handler (main Lambda function)
  - Implement main Lambda handler with complete Middy stack
  - Add Powertools logger, tracer, and metrics initialization
  - Integrate all custom middleware and components in correct order
  - Wire together all quota, budget, and context managers
  - Use Node.js 20 runtime with TypeScript compilation
  - _Requirements: Core webhook processing (Requirement 9.5)_

- [ ] 11. Implement message extraction and transformation
  - Create functions to extract messages from Telegram updates
  - Transform Telegram format to internal chat format
  - Handle different message types (text, commands, callbacks)
  - Integrate with Message_Validator for content processing
  - _Requirements: Message processing and format conversion_

- [ ] 12. Integrate with existing chat API
  - Connect webhook handler to existing @ai-commerce/core chat logic
  - Propagate trace context through chat processing
  - Add error handling and retry mechanisms
  - Integrate Product_Selector with catalog system
  - _Requirements: Chat integration and recommendation generation_

- [ ] 13. Implement response formatting for Telegram
  - Create functions to format chat responses for Telegram
  - Generate inline keyboards for product recommendations
  - Handle message truncation and formatting constraints
  - Integrate with Response_Manager for length limits
  - _Requirements: Response formatting and user interaction_

- [ ] 14. Add comprehensive error handling
  - Implement custom error classes with trace context
  - Create error handler middleware for different error types
  - Add graceful degradation for external service failures
  - Handle quota and budget exceeded scenarios
  - Log rate limits, quotas, and token budget violations without sensitive content
  - _Requirements: Error handling and system reliability (Requirement 10.9)_

- [ ] 15. Set up CDK_Stack infrastructure (serverless only)
  - Create Lambda function configuration with Powertools
  - Set up API_Gateway using HTTP API (not REST API) to minimize costs
  - Configure DynamoDB tables for quotas, budgets, and context
  - Set up proper DynamoDB indexes and TTL configurations
  - Configure environment variables and IAM permissions
  - Enable X-Ray tracing and CloudWatch integration
  - Add CloudWatch alarms for quotas, budgets, and errors
  - Output webhook URL for Telegram configuration
  - _Requirements: Infrastructure and deployment (Requirement 9.2, 9.3, 9.4)_

- [ ] 16. Implement unit tests
  - Test custom parser middleware with valid/invalid data
  - Test signature validation with known test vectors
  - Test rate limiting with DynamoDB atomic operations
  - Test Daily_Quota_Manager with quota scenarios and TTL
  - Test Token_Budget_Manager with budget scenarios and atomic counters
  - Test Context_Manager with conversation flows and TTL cleanup
  - Test Product_Selector with different product sets
  - Test Response_Manager with various response scenarios
  - Test message transformation functions
  - Test error handling scenarios
  - _Requirements: Testing and validation_

- [ ] 17. Add integration tests
  - Test complete webhook flow with mock Telegram updates
  - Test Powertools integration (logging, tracing, metrics)
  - Test quota and budget enforcement with DynamoDB
  - Test context management across multiple conversations
  - Test product selection and LLM integration
  - Test DynamoDB TTL and cleanup mechanisms
  - Test error scenarios and recovery mechanisms
  - _Requirements: End-to-end testing_

- [ ] 18. Final integration and deployment
  - Deploy to test environment with development bot
  - Configure Bot_Token and BotFather integration
  - Verify webhook endpoint responds correctly
  - Test all quota and budget management in real environment
  - Test DynamoDB performance and cost optimization
  - Test various message types and error scenarios
  - Monitor logs, traces, and metrics in CloudWatch
  - Set up alerts for quotas, budgets, rate limits, and errors
  - _Requirements: Deployment and monitoring_

## DynamoDB Table Designs

### Rate Limiting Table

```typescript
TableName: telegram-rate-limits
PartitionKey: chat_id (number)
SortKey: window_start (string) // ISO timestamp
TTL: expires_at (number) // Unix timestamp
Attributes: {
  request_count: number,
  limit: number,
  window_size_ms: number
}
```

### Daily Quotas Table

```typescript
TableName: telegram-quotas
PartitionKey: user_id#date (string) // e.g., "123456#2024-01-15"
TTL: expires_at (number) // Unix timestamp (next day)
Attributes: {
  user_id: number,
  date: string,
  message_count: number,
  message_limit: number,
  token_count: number,
  token_limit: number
}
```

### Conversation Context Table

```typescript
TableName: telegram-context
PartitionKey: user_id#chat_id (string)
TTL: expires_at (number) // Unix timestamp (24h after last activity)
Attributes: {
  user_id: number,
  chat_id: number,
  messages: ContextMessage[],
  last_activity: string, // ISO timestamp
  token_count: number,
  summary: string
}
```

## Environment Variables

```typescript
// Rate limiting
RATE_LIMIT_PER_USER_PER_MINUTE = 10;
RATE_LIMIT_GLOBAL_PER_MINUTE = 1000;

// Daily quotas
DAILY_MESSAGE_QUOTA_PER_USER = 50;
DAILY_TOKEN_BUDGET_PER_USER = 10000;

// Context management
MAX_CONTEXT_MESSAGES = 6;
MAX_CONTEXT_TOKENS = 4000;

// Product selection
MAX_PRODUCTS_FOR_LLM = 10;
PRODUCT_CARD_MAX_CHARS = 300;

// Response management
MAX_RESPONSE_LENGTH = 4096;
MAX_RESPONSE_TOKENS = 1000;
RESPONSE_TIMEOUT_MS = 30000;

// Infrastructure (DynamoDB only)
TELEGRAM_BOT_TOKEN = your - bot - token;
DYNAMODB_RATE_LIMITS_TABLE = telegram - rate - limits;
DYNAMODB_QUOTAS_TABLE = telegram - quotas;
DYNAMODB_CONTEXT_TABLE = telegram - context;
```

## Notes

- **Serverless Architecture**: All storage uses DynamoDB (no Redis, no always-on infrastructure)
- **Cost Optimization**: HTTP API Gateway, DynamoDB TTL for cleanup, optimized LLM usage
- **Atomic Operations**: DynamoDB conditional updates prevent race conditions
- **Auto Cleanup**: TTL automatically removes expired data
- **Observability**: AWS Lambda Powertools throughout
- **Type Safety**: Custom Zod parser middleware
- **Abuse Protection**: Comprehensive quotas, budgets, and rate limiting
- **Scalability**: DynamoDB scales automatically with usage
