#!/usr/bin/env node
import { App, Environment } from 'aws-cdk-lib';
import { TelegramChatbotStack } from './stacks/telegram-chatbot-stack';

const app = new App();

// Get environment configuration
const environment = app.node.tryGetContext('environment') || 'dev';
const region =
  app.node.tryGetContext('region') ||
  process.env.CDK_DEFAULT_REGION ||
  'eu-west-1';
const account =
  app.node.tryGetContext('account') || process.env.CDK_DEFAULT_ACCOUNT;

const toBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return undefined;
};

const commerceGuardrailEnabled = toBoolean(
  app.node.tryGetContext('commerceGuardrailEnabled')
);

// AWS environment
const env: Environment = {
  account,
  region,
};

// Stack configuration
const stackName = `telegram-chatbot-${environment}`;

// Create the main stack
new TelegramChatbotStack(app, stackName, {
  env,
  environment,

  // Optional configuration from context
  telegramBotToken: app.node.tryGetContext('telegramBotToken'),
  telegramSecretToken: app.node.tryGetContext('telegramSecretToken'),
  catalogBucket: app.node.tryGetContext('catalogBucket'),
  catalogPrefix: app.node.tryGetContext('catalogPrefix'),

  bedrockModels: {
    embedModel: app.node.tryGetContext('embedModel'),
    chatModel: app.node.tryGetContext('chatModel'),
  },

  // Optional: account-level Bedrock Guardrail enforcement (per region)
  commerceGuardrailEnabled,

  // Stack metadata
  description: `Telegram chatbot infrastructure for ${environment} environment`,
  tags: {
    Environment: environment,
    Project: 'telegram-chatbot',
    ManagedBy: 'CDK',
  },
});

app.synth();
