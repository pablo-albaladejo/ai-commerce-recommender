import z from 'zod';

const textDescription =
  'The agent reply message to send back to the user after the selection. Keep it concise and practical.';

export const agentReplySelectionStructuredOutputV1 = () => {
  return z
    .object({
      text: z.string().min(1).describe(textDescription),
    })
    .strict();
};
