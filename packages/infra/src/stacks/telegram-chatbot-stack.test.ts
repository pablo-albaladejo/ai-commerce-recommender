import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TelegramChatbotStack } from './telegram-chatbot-stack';

describe('TelegramChatbotStack', () => {
  let app: App;
  let stack: TelegramChatbotStack;
  let template: Template;

  beforeEach(() => {
    app = new App();
    stack = new TelegramChatbotStack(app, 'TestStack', {
      environment: 'test',
    });
    template = Template.fromStack(stack);
  });

  test('creates Lambda function with correct configuration', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      // NodejsFunction with esbuild bundling outputs index.handler
      Handler: 'index.handler',
      Timeout: 30,
      MemorySize: 512,
      Architectures: ['arm64'],
      TracingConfig: {
        Mode: 'Active',
      },
    });
  });

  test('creates HTTP API Gateway', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      ProtocolType: 'HTTP',
      Description: 'HTTP API for Telegram chatbot webhook',
    });
  });

  test('creates DynamoDB tables with correct configuration', () => {
    // Quotas table
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      TimeToLiveSpecification: {
        AttributeName: 'ttl',
        Enabled: true,
      },
    });

    // Check for GSI
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: [
        {
          IndexName: 'QuotaTypeIndex',
          Projection: {
            ProjectionType: 'ALL',
          },
        },
      ],
    });
  });

  test('creates CloudWatch alarms', () => {
    // Lambda error alarm
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'Errors',
      Namespace: 'AWS/Lambda',
      Threshold: 5,
    });

    // Lambda duration alarm
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'Duration',
      Namespace: 'AWS/Lambda',
      Threshold: 25000,
    });

    // DynamoDB throttling alarm
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'ThrottledRequests',
      Namespace: 'AWS/DynamoDB',
    });
  });

  test('configures proper IAM permissions', () => {
    // Check that IAM policy exists
    const policies = template.findResources('AWS::IAM::Policy');
    expect(Object.keys(policies)).toHaveLength(1);

    // Check that the policy has the correct version
    const policyKey = Object.keys(policies)[0];
    const policy = policies[policyKey];
    expect(policy.Properties.PolicyDocument.Version).toBe('2012-10-17');

    // Check that there are multiple statements (for different services)
    expect(policy.Properties.PolicyDocument.Statement.length).toBeGreaterThan(
      1
    );

    // Check that all statements have Allow effect
    policy.Properties.PolicyDocument.Statement.forEach(
      (statement: { Effect: string }) => {
        expect(statement.Effect).toBe('Allow');
      }
    );
  });

  test('sets correct environment variables', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          POWERTOOLS_SERVICE_NAME: 'telegram-chatbot',
          POWERTOOLS_METRICS_NAMESPACE: 'TelegramChatbot',
          LOG_LEVEL: 'INFO',
          ENVIRONMENT: 'test',
          TITAN_EMBED_MODEL_ID: 'amazon.titan-embed-text-v1',
          CLAUDE_MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0',
          CACHE_TTL_SECONDS: '300',
        },
      },
    });
  });

  test('creates stack outputs', () => {
    template.hasOutput('WebhookUrl', {
      Description: 'Telegram webhook URL for bot configuration',
    });

    template.hasOutput('ApiId', {
      Description: 'HTTP API Gateway ID',
    });

    template.hasOutput('LambdaFunctionName', {
      Description: 'Telegram webhook Lambda function name',
    });
  });

  test('configures API Gateway route correctly', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'POST /telegram/webhook',
      AuthorizationType: 'NONE',
    });
  });

  test('enables dead letter queue', () => {
    template.hasResourceProperties('AWS::SQS::Queue', {
      MessageRetentionPeriod: 1209600, // 14 days
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      DeadLetterConfig: {},
    });
  });
});
