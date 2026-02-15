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

export const InstagramOptionsSchema = z.object({
  location_id: z.string().optional(),
  audio_id: z.string().optional(),
  audio_name: z.string().optional(),
  audio_artist: z.string().optional(),
});

export type InstagramOptions = z.infer<typeof InstagramOptionsSchema>;

export const FacebookOptionsSchema = z.object({
  link: z.string().optional(),
});

export type FacebookOptions = z.infer<typeof FacebookOptionsSchema>;

export const MastodonOptionsSchema = z.object({
  visibility: z.enum(['public', 'unlisted', 'private', 'direct']).optional(),
  spoiler_text: z.string().optional(),
  sensitive: z.boolean().optional(),
});

export type MastodonOptions = z.infer<typeof MastodonOptionsSchema>;

export const BlueskyOptionsSchema = z.object({
  langs: z.string().optional(),
});

export type BlueskyOptions = z.infer<typeof BlueskyOptionsSchema>;

export const DiscordOptionsSchema = z.object({
  thread_id: z.string().optional(),
  suppress_embeds: z.boolean().optional(),
});

export type DiscordOptions = z.infer<typeof DiscordOptionsSchema>;

export const ThreadsOptionsSchema = z.object({
  reply_to: z.string().optional(),
  reply_control: z.enum(['everyone', 'accounts_you_follow', 'mentioned_only']).optional(),
});

export type ThreadsOptions = z.infer<typeof ThreadsOptionsSchema>;

export const PlatformOptionsSchema = z.discriminatedUnion('platform', [
  z.object({ platform: z.literal('twitter'), options: TwitterOptionsSchema }),
  z.object({ platform: z.literal('telegram'), options: TelegramOptionsSchema }),
  z.object({ platform: z.literal('instagram'), options: InstagramOptionsSchema }),
  z.object({ platform: z.literal('facebook'), options: FacebookOptionsSchema }),
  z.object({ platform: z.literal('mastodon'), options: MastodonOptionsSchema }),
  z.object({ platform: z.literal('bluesky'), options: BlueskyOptionsSchema }),
  z.object({ platform: z.literal('discord'), options: DiscordOptionsSchema }),
  z.object({ platform: z.literal('threads'), options: ThreadsOptionsSchema }),
]);

export type PlatformOptions = z.infer<typeof PlatformOptionsSchema>;
