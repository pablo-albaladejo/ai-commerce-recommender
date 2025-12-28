# Requirements Document

## Introduction

A minimal Telegram chatbot backend deployed on AWS using CDK that receives webhook updates and responds with pseudo-streaming messages. The bot demonstrates real-time message editing capabilities while maintaining cost-effectiveness and simplicity for demo purposes. The bot includes comprehensive abuse protection to prevent token/cost abuse in a public deployment.

## Glossary

- **Telegram_Bot**: The chatbot application that receives and responds to user messages
- **Webhook_Handler**: The Lambda function that processes incoming Telegram webhook updates
- **Update_Object**: The JSON payload sent by Telegram containing message data
- **API_Gateway**: AWS API Gateway that receives webhook requests from Telegram
- **CDK_Stack**: The AWS CDK infrastructure definition for deploying the bot
- **Bot_Token**: The authentication token provided by Telegram for API access
- **BotFather**: Telegram's official bot for creating and managing other bots
- **Rate_Limiter**: Component that enforces per-user message rate limits
- **Daily_Quota_Manager**: Component that tracks and enforces daily message quotas
- **Token_Budget_Manager**: Component that tracks and enforces daily token usage limits
- **Message_Validator**: Component that validates and processes incoming message content
- **Response_Manager**: Component that manages LLM response generation and limits
- **Context_Manager**: Component that manages conversation history sent to LLM
- **Product_Selector**: Component that selects and formats products for LLM processing

## Requirements

### Requirement 1: Telegram Webhook Integration

**User Story:** As a Telegram user, I want to send messages to a bot and receive responses, so that I can interact with the chatbot service.

#### Acceptance Criteria

1. WHEN Telegram sends a webhook update to the API endpoint, THE Webhook_Handler SHALL receive and parse the Update_Object
2. WHEN the webhook receives a text message, THE Webhook_Handler SHALL extract the message content and chat ID
3. WHEN processing completes, THE API_Gateway SHALL return HTTP 200 status within 10 seconds to prevent Telegram retries
4. IF the webhook receives non-text message types, THEN THE Webhook_Handler SHALL log the event and return success without processing
5. WHEN webhook secret token is configured, THE Webhook_Handler SHALL validate the X-Telegram-Bot-Api-Secret-Token header

### Requirement 2: Pseudo-Streaming Response System

**User Story:** As a user, I want to see the bot "thinking" and then watch the response appear progressively, so that I feel the interaction is responsive and engaging.

#### Acceptance Criteria

1. WHEN a text message is received, THE Webhook_Handler SHALL immediately send a placeholder message containing "Thinking…"
2. WHEN the placeholder is sent, THE Webhook_Handler SHALL store the message ID for subsequent edits
3. WHILE generating the response, THE Webhook_Handler SHALL edit the message at intervals of 500-800ms
4. WHEN editing messages, THE Webhook_Handler SHALL respect Telegram's rate limits and retry with exponential backoff on 429 errors
5. WHEN the final response exceeds 4096 characters, THE Webhook_Handler SHALL truncate the message and append "... (truncated)"

### Requirement 3: AWS Infrastructure Deployment

**User Story:** As a developer, I want to deploy the bot infrastructure from my local machine using simple commands, so that I can quickly set up and test the chatbot.

#### Acceptance Criteria

1. WHEN running `cdk bootstrap`, THE CDK_Stack SHALL initialize the AWS environment for deployment
2. WHEN running `npm run cdk:deploy`, THE CDK_Stack SHALL create all required AWS resources
3. WHEN deployment completes, THE CDK_Stack SHALL output the webhook URL for Telegram configuration
4. THE API_Gateway SHALL use HTTP API (not REST API) to minimize costs
5. THE Webhook_Handler SHALL use Node.js 20 runtime with TypeScript compilation

### Requirement 4: Telegram Bot API Integration

**User Story:** As a system, I want to communicate with Telegram's Bot API reliably, so that messages are sent and edited successfully.

#### Acceptance Criteria

1. WHEN sending messages, THE Webhook_Handler SHALL use the sendMessage API endpoint with proper authentication
2. WHEN editing messages, THE Webhook_Handler SHALL use the editMessageText API endpoint with the stored message ID
3. WHEN API calls fail, THE Webhook_Handler SHALL log errors and implement retry logic with exponential backoff
4. THE Webhook_Handler SHALL validate the Bot_Token format before making API calls
5. WHEN rate limits are exceeded, THE Webhook_Handler SHALL wait and retry according to Telegram's guidelines

### Requirement 5: Error Handling and Logging

**User Story:** As a developer, I want comprehensive error handling and logging, so that I can debug issues and monitor the bot's performance.

#### Acceptance Criteria

1. WHEN any error occurs, THE Webhook_Handler SHALL log the error with context and continue processing
2. WHEN Telegram API calls fail, THE Webhook_Handler SHALL log the response status and error message
3. WHEN webhook validation fails, THE Webhook_Handler SHALL log the security violation and return 401
4. THE Webhook_Handler SHALL log all incoming webhook requests at debug level
5. WHEN processing completes successfully, THE Webhook_Handler SHALL log the completion time and message ID

### Requirement 6: Configuration Management

**User Story:** As a developer, I want to configure the bot through environment variables, so that I can deploy to different environments without code changes.

#### Acceptance Criteria

1. THE Webhook_Handler SHALL require TELEGRAM_BOT_TOKEN environment variable for authentication
2. THE Webhook_Handler SHALL use TELEGRAM_API_BASE environment variable with default "https://api.telegram.org"
3. THE Webhook_Handler SHALL use WEBHOOK_SECRET_TOKEN environment variable for request validation when available
4. THE Webhook_Handler SHALL use LOG_LEVEL environment variable with default "info"
5. WHEN required environment variables are missing, THE Webhook_Handler SHALL fail fast with descriptive error messages

### Requirement 7: Repository Structure and Build System

**User Story:** As a developer, I want a well-organized codebase with clear build scripts, so that I can easily understand, modify, and deploy the bot.

#### Acceptance Criteria

1. THE repository SHALL follow the monorepo structure with packages for infra and lambda code
2. THE build system SHALL use pnpm workspaces for dependency management
3. THE TypeScript configuration SHALL use project references for incremental builds
4. THE package.json SHALL include scripts for build, test, lint, format, and deployment
5. WHEN building, THE system SHALL compile TypeScript to JavaScript and bundle dependencies

### Requirement 8: Telegram Bot Setup and Configuration

**User Story:** As a developer, I want clear instructions and scripts for creating and configuring the Telegram bot, so that I can quickly set up the bot without manual errors.

#### Acceptance Criteria

1. THE documentation SHALL provide step-by-step instructions for creating a bot using BotFather
2. THE documentation SHALL include commands for setting the webhook URL after deployment
3. THE system SHALL provide environment variable templates for configuration
4. THE documentation SHALL include troubleshooting steps for common setup issues
5. WHEN the webhook is set, THE system SHALL provide a way to test the bot end-to-end

### Requirement 9: Security and Authentication

**User Story:** As a system administrator, I want the bot to be secure against unauthorized access, so that only legitimate Telegram updates are processed.

#### Acceptance Criteria

1. WHERE webhook secret token is available, THE Webhook_Handler SHALL validate all incoming requests
2. THE Webhook_Handler SHALL only process updates from Telegram's IP ranges (if validation is implemented)
3. THE Bot_Token SHALL be stored securely and never logged or exposed in responses

### Requirement 10: Public Bot Abuse Protection

**User Story:** As a system administrator, I want to protect the public bot from abuse and excessive costs, so that the service remains available and cost-effective for legitimate users.

#### Acceptance Criteria

1. WHEN a user sends more than 6 messages per minute, THE Rate_Limiter SHALL respond with "Too many requests, please wait and try again" and SHALL NOT call the LLM
2. WHEN a user exceeds 100 messages per day, THE Daily_Quota_Manager SHALL respond with "Daily limit reached, please try again tomorrow" and SHALL NOT call the LLM
3. WHEN a user exceeds 30,000 tokens per day, THE Token_Budget_Manager SHALL return a short static response and SHALL NOT call the LLM
4. WHEN an incoming message exceeds 1,500 characters, THE Message_Validator SHALL truncate the message or ask the user to shorten it
5. WHEN generating responses, THE Response_Manager SHALL set max_tokens to 250-350 to limit response length
6. WHEN sending conversation history to the LLM, THE Context_Manager SHALL send only the last 6 user/assistant messages plus a compact summary
7. WHEN selecting products for LLM re-ranking, THE Product_Selector SHALL pass only the top 8-10 candidates with each serialized as a short card (max 250-300 characters)
8. THE Rate_Limiter SHALL use DynamoDB with chat_id as partition key and TTL for auto-expiring counters
9. THE System SHALL log when rate limits, quotas, or token budgets are exceeded without logging sensitive user content
10. WHEN rate limits or quotas are enforced, THE System SHALL use DynamoDB conditional updates or atomic counters to avoid race conditions
