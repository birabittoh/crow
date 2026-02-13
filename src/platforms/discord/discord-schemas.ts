import { z } from 'zod';

export const DISCORD_MAX_MESSAGE_LENGTH = 2000;
export const DISCORD_MAX_EMBED_DESCRIPTION_LENGTH = 4096;
export const DISCORD_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (50MB with Nitro boost)

export const DiscordPostValidationSchema = z.object({
  text: z.string(),
  hasMedia: z.boolean(),
}).refine(
  (data) => {
    return data.text.length <= DISCORD_MAX_MESSAGE_LENGTH;
  },
  {
    message: 'Text exceeds Discord message length limit',
  }
);
