import { contentToPlainText } from '../../domain/agent/content';
import { AgentModelOutputBuilder } from '../../tests/fixtures/agent-model.builder';
import { AgentTurnInputBuilder } from '../../tests/fixtures/agent-turn.builder';
import { createSingleTurnLlmAgent } from './single-turn-llm-agent';

describe('createSingleTurnLlmAgent', () => {
  it('calls getAgentReply and returns a send_message action with the model text', async () => {
    const turn = AgentTurnInputBuilder.build({ locale: 'en' });
    const modelOutput = AgentModelOutputBuilder.build();

    const getAgentReply = jest.fn().mockResolvedValue(modelOutput);
    const agent = createSingleTurnLlmAgent(getAgentReply);

    const output = await agent(turn);

    expect(getAgentReply).toHaveBeenCalledWith({
      turn,
      systemPromptOverride: undefined,
    });

    expect(output.actions).toHaveLength(1);
    const action = output.actions[0];
    expect(action.type).toBe('send_message');
    if (action.type !== 'send_message') {
      throw new Error(`Expected send_message action, got: ${action.type}`);
    }

    expect(contentToPlainText(action.content)).toBe(
      contentToPlainText(modelOutput.message.content)
    );

    expect(output.llm).toEqual({
      modelId: modelOutput.modelId,
      finishReason: modelOutput.finishReason,
      tokenUsage: modelOutput.tokenUsage,
    });
  });

  it('bubbles AI SDK errors to be handled by the central error-handler', async () => {
    const turn = AgentTurnInputBuilder.build();
    const error = new Error('Bedrock denied');
    error.name = 'AI_APICallError';

    const getAgentReply = jest.fn().mockRejectedValue(error);
    const agent = createSingleTurnLlmAgent(getAgentReply);

    await expect(agent(turn)).rejects.toThrow('Bedrock denied');
  });

  it('rethrows non-AI errors to be handled by the central error-handler', async () => {
    const turn = AgentTurnInputBuilder.build();

    const getAgentReply = jest.fn().mockRejectedValue(new Error('Bug'));
    const agent = createSingleTurnLlmAgent(getAgentReply);

    await expect(agent(turn)).rejects.toThrow('Bug');
  });
});
