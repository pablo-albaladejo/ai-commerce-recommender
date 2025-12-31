import type { IRole } from 'aws-cdk-lib/aws-iam';
import {
  AwsCustomResource,
  PhysicalResourceId,
  PhysicalResourceIdReference,
} from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

export type CommerceGuardrailParams = {
  environment: string;
  stackName: string;
  role: IRole;
};

const buildTopicPolicyConfig = () => {
  return {
    topicsConfig: [
      {
        name: 'OutOfScopeNonCommerce',
        definition:
          'Any user query or assistant response that is not about this store, its products, pricing, discounts, ordering, shipping, returns, or store policies.',
        examples: [
          'What is the weather today?',
          'Write a poem about the ocean.',
          'Who won the football match?',
          'Help me debug this JavaScript code.',
        ],
        type: 'DENY',
        inputAction: 'BLOCK',
        outputAction: 'BLOCK',
        inputEnabled: true,
        outputEnabled: true,
      },
    ],
    // NOTE: STANDARD tier can require cross-region inference to be enabled for guardrails
    // (depending on region/account settings). CLASSIC is broadly available and keeps
    // deployments predictable.
    tierConfig: { tierName: 'CLASSIC' },
  };
};

const buildGuardrailParameters = (params: {
  environment: string;
  guardrailName: string;
  blockedMessage: string;
}) => {
  const { environment, guardrailName, blockedMessage } = params;

  return {
    name: guardrailName,
    description: `Account-level guardrail to constrain the Telegram bot to commerce scope (${environment}).`,
    topicPolicyConfig: buildTopicPolicyConfig(),
    blockedInputMessaging: blockedMessage,
    blockedOutputsMessaging: blockedMessage,
  };
};

const createCommerceOnlyGuardrail = (params: {
  scope: Construct;
  role: IRole;
  environment: string;
  guardrailName: string;
  blockedMessage: string;
}) => {
  const { scope, role, environment, guardrailName, blockedMessage } = params;
  const guardrailParameters = buildGuardrailParameters({
    environment,
    guardrailName,
    blockedMessage,
  });

  return new AwsCustomResource(scope, 'CommerceOnlyGuardrail', {
    role,
    installLatestAwsSdk: true,
    onCreate: {
      service: 'Bedrock',
      action: 'createGuardrail',
      parameters: guardrailParameters,
      physicalResourceId: PhysicalResourceId.fromResponse('guardrailId'),
    },
    onUpdate: {
      service: 'Bedrock',
      action: 'updateGuardrail',
      parameters: {
        guardrailIdentifier: new PhysicalResourceIdReference(),
        ...guardrailParameters,
      },
    },
    onDelete: {
      service: 'Bedrock',
      action: 'deleteGuardrail',
      parameters: {
        guardrailIdentifier: new PhysicalResourceIdReference(),
      },
      // If CREATE failed, the custom resource physical id may not be a guardrail id/arn.
      // Ignore validation errors so CloudFormation rollbacks don't get stuck.
      ignoreErrorCodesMatching: 'ResourceNotFoundException|ValidationException',
    },
  });
};

const createCommerceOnlyGuardrailVersion = (params: {
  scope: Construct;
  role: IRole;
  environment: string;
  stackName: string;
  guardrailId: string;
}) => {
  const { scope, role, environment, stackName, guardrailId } = params;

  return new AwsCustomResource(scope, 'CommerceOnlyGuardrailVersion', {
    role,
    installLatestAwsSdk: true,
    onUpdate: {
      // Will also be called for CREATE events.
      service: 'Bedrock',
      action: 'createGuardrailVersion',
      parameters: {
        guardrailIdentifier: guardrailId,
        description: `Deployed by CDK (${stackName})`,
      },
      physicalResourceId: PhysicalResourceId.of(
        `CommerceOnlyGuardrailVersion-${environment}`
      ),
    },
  });
};

const createCommerceOnlyEnforcedConfig = (params: {
  scope: Construct;
  role: IRole;
  guardrailId: string;
  guardrailVersionNumber: string;
}) => {
  const { scope, role, guardrailId, guardrailVersionNumber } = params;

  return new AwsCustomResource(scope, 'CommerceOnlyEnforcedGuardrailConfig', {
    role,
    installLatestAwsSdk: true,
    onCreate: {
      service: 'Bedrock',
      action: 'putEnforcedGuardrailConfiguration',
      parameters: {
        // NOTE: configId is not provided on create; Bedrock assigns one.
        guardrailInferenceConfig: {
          guardrailIdentifier: guardrailId,
          guardrailVersion: guardrailVersionNumber,
          inputTags: 'IGNORE',
        },
      },
      physicalResourceId: PhysicalResourceId.fromResponse('configId'),
    },
    onUpdate: {
      service: 'Bedrock',
      action: 'putEnforcedGuardrailConfiguration',
      parameters: {
        configId: new PhysicalResourceIdReference(),
        guardrailInferenceConfig: {
          guardrailIdentifier: guardrailId,
          guardrailVersion: guardrailVersionNumber,
          inputTags: 'IGNORE',
        },
      },
    },
    onDelete: {
      service: 'Bedrock',
      action: 'deleteEnforcedGuardrailConfiguration',
      parameters: { configId: new PhysicalResourceIdReference() },
      ignoreErrorCodesMatching: 'ResourceNotFoundException|ValidationException',
    },
  });
};

/**
 * Provisions and enforces an account-level Bedrock Guardrail designed to keep the bot
 * scoped to commerce questions.
 *
 * IMPORTANT: This is an account-level setting (per region) and can affect other Bedrock
 * workloads in the same AWS account.
 */
export const configureCommerceGuardrail = (
  scope: Construct,
  params: CommerceGuardrailParams
): void => {
  const { environment, stackName, role } = params;

  const guardrailName = `telegram-chatbot-commerce-only-${environment}`;
  const blockedMessage = 'Sorry, I can only answer questions about this store.';

  const guardrail = createCommerceOnlyGuardrail({
    scope,
    role,
    environment,
    guardrailName,
    blockedMessage,
  });

  const guardrailId = guardrail.getResponseField('guardrailId');

  const guardrailVersion = createCommerceOnlyGuardrailVersion({
    scope,
    role,
    environment,
    stackName,
    guardrailId,
  });
  guardrailVersion.node.addDependency(guardrail);

  const guardrailVersionNumber = guardrailVersion.getResponseField('version');

  const enforcedConfig = createCommerceOnlyEnforcedConfig({
    scope,
    role,
    guardrailId,
    guardrailVersionNumber,
  });
  enforcedConfig.node.addDependency(guardrailVersion);
};
