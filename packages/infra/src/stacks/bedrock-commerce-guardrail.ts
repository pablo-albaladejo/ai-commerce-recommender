import { createHash } from 'crypto';
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

const computeConfigHash = (value: unknown): string => {
  const json = JSON.stringify(value);
  return createHash('sha256').update(json).digest('hex').slice(0, 32);
};

const buildTopicPolicyConfig = () => {
  const denyTopic = (params: {
    name: string;
    definition: string;
    examples: string[];
  }) => {
    return {
      name: params.name,
      definition: params.definition,
      examples: params.examples,
      type: 'DENY',
      inputAction: 'BLOCK',
      outputAction: 'BLOCK',
      inputEnabled: true,
      outputEnabled: true,
    };
  };

  return {
    topicsConfig: [
      denyTopic({
        name: 'OutOfScopeCreativeWriting',
        definition:
          "Requests for stories, poems, jokes, roleplay, or other creative/entertainment content that isn't related to the store or shopping.",
        examples: [
          // EN / ES / PT / FR / DE+IT (combined) - max 5 examples per topic
          'Tell me a bedtime story.',
          'Cuéntame un cuento.',
          'Conte-me uma história.',
          'Raconte-moi une histoire.',
          'Erzähl mir eine Geschichte. / Raccontami una storia.',
        ],
      }),
      denyTopic({
        name: 'OutOfScopeGeneralKnowledge',
        definition:
          "General knowledge, trivia, news, weather, sports, politics, or educational questions that aren't related to the store or shopping.",
        examples: [
          // EN / ES / PT / FR / DE+IT (combined) - max 5 examples per topic
          'What is the capital of France?',
          '¿Qué tiempo hace hoy?',
          'Qual é a capital da França?',
          'Quel temps fait-il aujourd’hui ?',
          'Was ist die Hauptstadt von Frankreich? / Qual è la capitale della Francia?',
        ],
      }),
      denyTopic({
        name: 'OutOfScopeProgrammingHelp',
        definition:
          "Programming/debugging/IT support requests that aren't related to the store or shopping.",
        examples: [
          // EN / ES / PT / FR / DE+IT (combined) - max 5 examples per topic
          'Help me debug this JavaScript code.',
          '¿Cómo arreglo este error de TypeScript?',
          'Como corrijo este erro de TypeScript?',
          'Aide-moi à déboguer ce code JavaScript.',
          'Hilf mir, diesen TypeScript-Fehler zu beheben. / Aiutami a risolvere questo errore TypeScript.',
        ],
      }),
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

type GuardrailParameters = ReturnType<typeof buildGuardrailParameters>;

const createCommerceOnlyGuardrail = (params: {
  scope: Construct;
  role: IRole;
  guardrailParameters: GuardrailParameters;
}) => {
  const { scope, role, guardrailParameters } = params;

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
  configHash: string;
}) => {
  const { scope, role, environment, stackName, guardrailId, configHash } =
    params;

  return new AwsCustomResource(scope, 'CommerceOnlyGuardrailVersion', {
    role,
    installLatestAwsSdk: true,
    onUpdate: {
      // Will also be called for CREATE events.
      service: 'Bedrock',
      action: 'createGuardrailVersion',
      parameters: {
        guardrailIdentifier: guardrailId,
        description: `Deployed by CDK (${stackName}) config=${configHash}`,
        clientRequestToken: configHash,
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
  configHash: string;
}) => {
  const { scope, role, guardrailId, guardrailVersionNumber, configHash } =
    params;

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
        // Trigger redeploys on guardrail policy changes without affecting the AWS API request.
        // (Unknown params are ignored by the AWS SDK serializer.)
        _trigger: configHash,
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
        _trigger: configHash,
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

  const guardrailParameters = buildGuardrailParameters({
    environment,
    guardrailName,
    blockedMessage,
  });
  const configHash = computeConfigHash({
    topicPolicyConfig: guardrailParameters.topicPolicyConfig,
    blockedInputMessaging: guardrailParameters.blockedInputMessaging,
    blockedOutputsMessaging: guardrailParameters.blockedOutputsMessaging,
  });

  const guardrail = createCommerceOnlyGuardrail({
    scope,
    role,
    guardrailParameters,
  });

  const guardrailId = guardrail.getResponseField('guardrailId');

  const guardrailVersion = createCommerceOnlyGuardrailVersion({
    scope,
    role,
    environment,
    stackName,
    guardrailId,
    configHash,
  });
  guardrailVersion.node.addDependency(guardrail);

  const guardrailVersionNumber = guardrailVersion.getResponseField('version');

  const enforcedConfig = createCommerceOnlyEnforcedConfig({
    scope,
    role,
    guardrailId,
    guardrailVersionNumber,
    configHash,
  });
  enforcedConfig.node.addDependency(guardrailVersion);
};
