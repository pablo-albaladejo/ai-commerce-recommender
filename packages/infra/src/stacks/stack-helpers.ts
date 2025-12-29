import { CfnOutput, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import {
  Alarm,
  ComparisonOperator,
  Metric,
  TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch';
import {
  AttributeType,
  BillingMode,
  ProjectionType,
  Table,
} from 'aws-cdk-lib/aws-dynamodb';

type TableConfig = {
  pk: string;
  sk: string;
  gsiPk: string;
  gsiSk: string;
  gsiName: string;
};

export const createTable = (
  stack: Stack,
  id: string,
  name: string,
  config: TableConfig
): Table => {
  const table = new Table(stack, id, {
    tableName: name,
    partitionKey: { name: config.pk, type: AttributeType.STRING },
    sortKey: { name: config.sk, type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
    timeToLiveAttribute: 'ttl',
    removalPolicy: RemovalPolicy.DESTROY,
  });
  table.addGlobalSecondaryIndex({
    indexName: config.gsiName,
    partitionKey: { name: config.gsiPk, type: AttributeType.STRING },
    sortKey: { name: config.gsiSk, type: AttributeType.STRING },
    projectionType: ProjectionType.ALL,
  });
  return table;
};

type LambdaAlarmConfig = {
  id: string;
  name: string;
  desc: string;
  metric: Metric;
  threshold: number;
  periods: number;
};

export const createLambdaAlarm = (stack: Stack, config: LambdaAlarmConfig) =>
  new Alarm(stack, config.id, {
    alarmName: config.name,
    alarmDescription: config.desc,
    metric: config.metric,
    threshold: config.threshold,
    evaluationPeriods: config.periods,
    comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    treatMissingData: TreatMissingData.NOT_BREACHING,
  });

export const createDynamoThrottleAlarm = (
  stack: Stack,
  table: Table,
  tableName: string,
  stackName: string
) =>
  new Alarm(stack, `${tableName}ThrottleAlarm`, {
    alarmName: `telegram-chatbot-${tableName.toLowerCase()}-throttle-${stackName}`,
    alarmDescription: `DynamoDB throttling on ${tableName} table`,
    metric: new Metric({
      namespace: 'AWS/DynamoDB',
      metricName: 'ThrottledRequests',
      dimensionsMap: { TableName: table.tableName },
      period: Duration.minutes(5),
    }),
    threshold: 1,
    evaluationPeriods: 2,
    comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    treatMissingData: TreatMissingData.NOT_BREACHING,
  });

type CustomAlarmConfig = {
  id: string;
  name: string;
  desc: string;
  namespace: string;
  metricName: string;
  threshold: number;
};

export const createCustomAlarm = (stack: Stack, config: CustomAlarmConfig) =>
  new Alarm(stack, config.id, {
    alarmName: config.name,
    alarmDescription: config.desc,
    metric: new Metric({
      namespace: config.namespace,
      metricName: config.metricName,
      period: Duration.minutes(15),
    }),
    threshold: config.threshold,
    evaluationPeriods: 2,
    comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    treatMissingData: TreatMissingData.NOT_BREACHING,
  });

export const createStackOutputs = (
  stack: Stack,
  outputs: Array<{
    id: string;
    value: string;
    desc: string;
    exportName: string;
  }>
) =>
  outputs.forEach(
    o =>
      new CfnOutput(stack, o.id, {
        value: o.value,
        description: o.desc,
        exportName: o.exportName,
      })
  );
