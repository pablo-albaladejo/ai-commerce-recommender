import {
  AgentTurnInputBuilder,
  AgentTurnOutputBuilder,
} from '../../tests/fixtures/agent-turn.builder';
import { processChatMessage } from './process-chat-message';

describe('processChatMessage', () => {
  it('runs the agent turn and emits the resulting actions', async () => {
    const emitAction = jest.fn().mockResolvedValue(undefined);
    const turnOutput = AgentTurnOutputBuilder.build();
    const runAgentTurn = jest.fn().mockResolvedValue(turnOutput);

    const useCase = processChatMessage(emitAction, runAgentTurn);

    const turnInput = AgentTurnInputBuilder.build();
    const result = await useCase(turnInput);

    expect(runAgentTurn).toHaveBeenCalledWith(turnInput);
    expect(emitAction).toHaveBeenCalledTimes(turnOutput.actions.length);
    for (const action of turnOutput.actions) {
      expect(emitAction).toHaveBeenCalledWith(action);
    }

    expect(result).toEqual(turnOutput);
  });
});
