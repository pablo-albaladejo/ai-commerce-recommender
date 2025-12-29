import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';
import {
  createCustomAlarm,
  createDynamoThrottleAlarm,
  createLambdaAlarm,
  createStackOutputs,
  createTable,
} from './stack-helpers';

export type TelegramChatbotStackProps = StackProps & {
  environment: string;
  telegramBotToken?: string;
  catalogBucket?: string;
  catalogPrefix?: string;
  bedrockModels?: { embedModel?: string; chatModel?: string };
};

type LambdaConfig = Pick<
  TelegramChatbotStackProps,
  | 'environment'
  | 'telegramBotToken'
  | 'catalogBucket'
  | 'catalogPrefix'
  | 'bedrockModels'
>;

export class TelegramChatbotStack extends Stack {
  public readonly telegramWebhookFunction: NodejsFunction;
  public readonly httpApi: HttpApi;
  public readonly quotasTable: Table;
  public readonly budgetsTable: Table;
  public readonly conversationContextTable: Table;
  public readonly webhookUrl: string;

  constructor(scope: Construct, id: string, props: TelegramChatbotStackProps) {
    super(scope, id, props);
    const {
      environment,
      telegramBotToken,
      catalogBucket,
      catalogPrefix,
      bedrockModels,
    } = props;

    this.quotasTable = createTable(
      this,
      'QuotasTable',
      `telegram-chatbot-quotas-${this.stackName}`,
      {
        pk: 'userId',
        sk: 'quotaType',
        gsiPk: 'quotaType',
        gsiSk: 'userId',
        gsiName: 'QuotaTypeIndex',
      }
    );
    this.budgetsTable = createTable(
      this,
      'BudgetsTable',
      `telegram-chatbot-budgets-${this.stackName}`,
      {
        pk: 'userId',
        sk: 'budgetPeriod',
        gsiPk: 'budgetPeriod',
        gsiSk: 'userId',
        gsiName: 'BudgetPeriodIndex',
      }
    );
    this.conversationContextTable = createTable(
      this,
      'ConversationContextTable',
      `telegram-chatbot-context-${this.stackName}`,
      {
        pk: 'chatId',
        sk: 'messageId',
        gsiPk: 'chatId',
        gsiSk: 'timestamp',
        gsiName: 'ChatIdTimestampIndex',
      }
    );

    this.telegramWebhookFunction = this.createLambdaFunction({
      environment,
      telegramBotToken,
      catalogBucket,
      catalogPrefix,
      bedrockModels,
    });
    this.grantPermissions(catalogBucket);

    this.httpApi = this.createHttpApi();
    this.httpApi.addRoutes({
      path: '/telegram/webhook',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'TelegramWebhookIntegration',
        this.telegramWebhookFunction
      ),
    });
    this.webhookUrl = `${this.httpApi.url}telegram/webhook`;

    this.createAlarms();
    this.createOutputs();
  }

  private createLambdaFunction(config: LambdaConfig): NodejsFunction {
    const func = new NodejsFunction(this, 'TelegramWebhookFunction', {
      functionName: `telegram-chatbot-webhook-${config.environment}`,
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      entry: path.join(
        __dirname,
        '../../../../packages/lambda/src/handlers/telegram/telegram-webhook.ts'
      ),
      handler: 'handler',
      timeout: Duration.seconds(30),
      memorySize: 512,
      tracing: Tracing.ACTIVE,
      environment: this.buildEnvVars(config),
      deadLetterQueueEnabled: true,
      depsLockFilePath: path.join(__dirname, '../../../../pnpm-lock.yaml'),
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'], // AWS SDK v3 is available in Lambda runtime
      },
    });
    func.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'xray:PutTraceSegments',
          'xray:PutTelemetryRecords',
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      })
    );
    return func;
  }

  private buildEnvVars(config: LambdaConfig): Record<string, string> {
    return {
      POWERTOOLS_SERVICE_NAME: 'telegram-chatbot',
      POWERTOOLS_METRICS_NAMESPACE: 'TelegramChatbot',
      POWERTOOLS_LOGGER_LOG_EVENT: 'false',
      POWERTOOLS_LOGGER_SAMPLE_RATE: '0.1',
      POWERTOOLS_TRACE_DISABLED: 'false',
      POWERTOOLS_TRACER_CAPTURE_RESPONSE: 'true',
      POWERTOOLS_TRACER_CAPTURE_ERROR: 'true',
      POWERTOOLS_METRICS_CAPTURE_COLD_START_METRIC: 'true',
      LOG_LEVEL: 'INFO',
      SERVICE_VERSION: '1.0.0',
      ENVIRONMENT: config.environment,
      QUOTAS_TABLE_NAME: this.quotasTable.tableName,
      BUDGETS_TABLE_NAME: this.budgetsTable.tableName,
      CONVERSATION_CONTEXT_TABLE_NAME: this.conversationContextTable.tableName,
      ...(config.telegramBotToken && {
        TELEGRAM_BOT_TOKEN: config.telegramBotToken,
      }),
      ...(config.catalogBucket && { CATALOG_BUCKET: config.catalogBucket }),
      ...(config.catalogPrefix && { CATALOG_PREFIX: config.catalogPrefix }),
      TITAN_EMBED_MODEL_ID:
        config.bedrockModels?.embedModel || 'amazon.titan-embed-text-v1',
      CLAUDE_MODEL_ID:
        config.bedrockModels?.chatModel ||
        'anthropic.claude-3-haiku-20240307-v1:0',
      CACHE_TTL_SECONDS: '300',
    };
  }

  private grantPermissions(catalogBucket?: string): void {
    this.quotasTable.grantReadWriteData(this.telegramWebhookFunction);
    this.budgetsTable.grantReadWriteData(this.telegramWebhookFunction);
    this.conversationContextTable.grantReadWriteData(
      this.telegramWebhookFunction
    );
    this.telegramWebhookFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: [`arn:aws:bedrock:${this.region}::foundation-model/*`],
      })
    );
    if (catalogBucket) {
      this.telegramWebhookFunction.addToRolePolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['s3:GetObject', 's3:ListBucket'],
          resources: [
            `arn:aws:s3:::${catalogBucket}`,
            `arn:aws:s3:::${catalogBucket}/*`,
          ],
        })
      );
    }
  }

  private createHttpApi(): HttpApi {
    return new HttpApi(this, 'TelegramChatbotApi', {
      apiName: `telegram-chatbot-api-${this.stackName}`,
      description: 'HTTP API for Telegram chatbot webhook',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Telegram-Bot-Api-Secret-Token',
        ],
      },
    });
  }

  private createAlarms(): void {
    createLambdaAlarm(this, {
      id: 'TelegramWebhookErrorAlarm',
      name: `telegram-chatbot-errors-${this.stackName}`,
      desc: 'High error rate in Telegram webhook function',
      metric: this.telegramWebhookFunction.metricErrors({
        period: Duration.minutes(5),
      }),
      threshold: 5,
      periods: 2,
    });
    createLambdaAlarm(this, {
      id: 'TelegramWebhookDurationAlarm',
      name: `telegram-chatbot-duration-${this.stackName}`,
      desc: 'High duration in Telegram webhook function',
      metric: this.telegramWebhookFunction.metricDuration({
        period: Duration.minutes(5),
      }),
      threshold: 25000,
      periods: 3,
    });
    createDynamoThrottleAlarm(this, this.quotasTable, 'Quotas', this.stackName);
    createDynamoThrottleAlarm(
      this,
      this.budgetsTable,
      'Budgets',
      this.stackName
    );
    createDynamoThrottleAlarm(
      this,
      this.conversationContextTable,
      'ConversationContext',
      this.stackName
    );
    createCustomAlarm(this, {
      id: 'QuotaBreachAlarm',
      name: `telegram-chatbot-quota-breach-${this.stackName}`,
      desc: 'High number of quota breaches',
      namespace: 'TelegramChatbot',
      metricName: 'QuotaExceeded',
      threshold: 10,
    });
    createCustomAlarm(this, {
      id: 'BudgetBreachAlarm',
      name: `telegram-chatbot-budget-breach-${this.stackName}`,
      desc: 'High number of budget breaches',
      namespace: 'TelegramChatbot',
      metricName: 'BudgetExceeded',
      threshold: 5,
    });
  }

  private createOutputs(): void {
    createStackOutputs(this, [
      {
        id: 'WebhookUrl',
        value: this.webhookUrl,
        desc: 'Telegram webhook URL for bot configuration',
        exportName: `${this.stackName}-webhook-url`,
      },
      {
        id: 'ApiId',
        value: this.httpApi.httpApiId,
        desc: 'HTTP API Gateway ID',
        exportName: `${this.stackName}-api-id`,
      },
      {
        id: 'LambdaFunctionName',
        value: this.telegramWebhookFunction.functionName,
        desc: 'Telegram webhook Lambda function name',
        exportName: `${this.stackName}-lambda-function-name`,
      },
      {
        id: 'QuotasTableName',
        value: this.quotasTable.tableName,
        desc: 'DynamoDB quotas table name',
        exportName: `${this.stackName}-quotas-table-name`,
      },
      {
        id: 'BudgetsTableName',
        value: this.budgetsTable.tableName,
        desc: 'DynamoDB budgets table name',
        exportName: `${this.stackName}-budgets-table-name`,
      },
      {
        id: 'ConversationContextTableName',
        value: this.conversationContextTable.tableName,
        desc: 'DynamoDB conversation context table name',
        exportName: `${this.stackName}-conversation-context-table-name`,
      },
    ]);
  }
}
