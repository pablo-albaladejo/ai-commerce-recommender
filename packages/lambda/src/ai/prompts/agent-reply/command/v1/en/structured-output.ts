import z from 'zod';

const textDescription =
  'The agent reply message to send back to the user in response to the command.';

export const agentReplyCommandStructuredOutputV1 = () => {
  return z
    .object({
      text: z.string().min(1).describe(textDescription),
    })
    .strict();
};
