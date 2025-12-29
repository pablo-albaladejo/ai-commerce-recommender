#!/usr/bin/env node
import { App, Environment } from 'aws-cdk-lib';
import { TelegramChatbotStack } from './stacks/telegram-chatbot-stack';

const app = new App();

// Get environment configuration
const environment = app.node.tryGetContext('environment') || 'dev';
const region =
  app.node.tryGetContext('region') ||
  process.env.CDK_DEFAULT_REGION ||
  'us-east-1';
const account =
  app.node.tryGetContext('account') || process.env.CDK_DEFAULT_ACCOUNT;

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
  catalogBucket: app.node.tryGetContext('catalogBucket'),
  catalogPrefix: app.node.tryGetContext('catalogPrefix'),

  bedrockModels: {
    embedModel: app.node.tryGetContext('embedModel'),
    chatModel: app.node.tryGetContext('chatModel'),
  },

  // Stack metadata
  description: `Telegram chatbot infrastructure for ${environment} environment`,
  tags: {
    Environment: environment,
    Project: 'telegram-chatbot',
    ManagedBy: 'CDK',
  },
});

app.synth();
