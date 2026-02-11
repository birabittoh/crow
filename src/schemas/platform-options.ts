import { z } from 'zod';

export const TwitterOptionsSchema = z.object({
  reply_to_tweet_id: z.string().optional(),
  quote_tweet_id: z.string().optional(),
});

export type TwitterOptions = z.infer<typeof TwitterOptionsSchema>;

export const TelegramOptionsSchema = z.object({
  parse_mode: z.enum(['MarkdownV2', 'HTML']).optional(),
  disable_web_page_preview: z.boolean().optional(),
  disable_notification: z.boolean().optional(),
});

export type TelegramOptions = z.infer<typeof TelegramOptionsSchema>;

export const PlatformOptionsSchema = z.discriminatedUnion('platform', [
  z.object({ platform: z.literal('twitter'), options: TwitterOptionsSchema }),
  z.object({ platform: z.literal('telegram'), options: TelegramOptionsSchema }),
]);

export type PlatformOptions = z.infer<typeof PlatformOptionsSchema>;
