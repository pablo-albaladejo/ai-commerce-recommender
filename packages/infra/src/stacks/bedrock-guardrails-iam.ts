import {
  Effect,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export type BedrockGuardrailsCustomResourceRoleParams = {
  /**
   * Optional override for the construct id.
   */
  id?: string;
};

/**
 * Shared execution role for `AwsCustomResource` providers that manage Bedrock Guardrails.
 *
 * NOTE: `AwsCustomResource` uses a singleton provider Lambda per stack. Passing the same
 * role to multiple custom resources keeps the permissions stable and avoids "late policy"
 * propagation issues during deployments.
 */
export const createBedrockGuardrailsCustomResourceRole = (
  scope: Construct,
  params: BedrockGuardrailsCustomResourceRoleParams = {}
): Role => {
  const id = params.id ?? 'BedrockGuardrailsCustomResourceRole';

  const role = new Role(scope, id, {
    assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    managedPolicies: [
      ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaBasicExecutionRole'
      ),
    ],
  });

  role.addToPolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'bedrock:CreateGuardrail',
        'bedrock:UpdateGuardrail',
        'bedrock:DeleteGuardrail',
        'bedrock:CreateGuardrailVersion',
        'bedrock:PutEnforcedGuardrailConfiguration',
        'bedrock:DeleteEnforcedGuardrailConfiguration',
      ],
      resources: ['*'],
    })
  );

  return role;
};
