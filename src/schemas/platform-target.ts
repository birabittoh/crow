import { z } from 'zod';
import { TwitterOptionsSchema, TelegramOptionsSchema, InstagramOptionsSchema, FacebookOptionsSchema, MastodonOptionsSchema, BlueskyOptionsSchema, DiscordOptionsSchema, ThreadsOptionsSchema } from './platform-options';
import { OverrideMediaSchema } from './media';

export const PlatformSchema = z.enum(['twitter', 'telegram', 'instagram', 'facebook', 'mastodon', 'bluesky', 'discord', 'threads']);
export type Platform = z.infer<typeof PlatformSchema>;

export const PublishStatusSchema = z.enum(['pending', 'publishing', 'published', 'failed']);
export type PublishStatus = z.infer<typeof PublishStatusSchema>;

const BaseTargetFields = {
  platform: PlatformSchema,
  override_content: z.string().nullable().optional(),
  override_media_json: OverrideMediaSchema.nullable().optional(),
};

export const CreateTwitterTargetSchema = z.object({
  ...BaseTargetFields,
  platform: z.literal('twitter'),
  override_options_json: TwitterOptionsSchema.nullable().optional(),
});

export const CreateTelegramTargetSchema = z.object({
  ...BaseTargetFields,
  platform: z.literal('telegram'),
  override_options_json: TelegramOptionsSchema.nullable().optional(),
});

export const CreateInstagramTargetSchema = z.object({
  ...BaseTargetFields,
  platform: z.literal('instagram'),
  override_options_json: InstagramOptionsSchema.nullable().optional(),
});

export const CreateFacebookTargetSchema = z.object({
  ...BaseTargetFields,
  platform: z.literal('facebook'),
  override_options_json: FacebookOptionsSchema.nullable().optional(),
});

export const CreateMastodonTargetSchema = z.object({
  ...BaseTargetFields,
  platform: z.literal('mastodon'),
  override_options_json: MastodonOptionsSchema.nullable().optional(),
});

export const CreateBlueskyTargetSchema = z.object({
  ...BaseTargetFields,
  platform: z.literal('bluesky'),
  override_options_json: BlueskyOptionsSchema.nullable().optional(),
});

export const CreateDiscordTargetSchema = z.object({
  ...BaseTargetFields,
  platform: z.literal('discord'),
  override_options_json: DiscordOptionsSchema.nullable().optional(),
});

export const CreateThreadsTargetSchema = z.object({
  ...BaseTargetFields,
  platform: z.literal('threads'),
  override_options_json: ThreadsOptionsSchema.nullable().optional(),
});

export const CreatePlatformTargetSchema = z.discriminatedUnion('platform', [
  CreateTwitterTargetSchema,
  CreateTelegramTargetSchema,
  CreateInstagramTargetSchema,
  CreateFacebookTargetSchema,
  CreateMastodonTargetSchema,
  CreateBlueskyTargetSchema,
  CreateDiscordTargetSchema,
  CreateThreadsTargetSchema,
]);

export type CreatePlatformTarget = z.infer<typeof CreatePlatformTargetSchema>;

export const PlatformTargetRowSchema = z.object({
  id: z.string().uuid(),
  post_id: z.string().uuid(),
  platform: PlatformSchema,
  override_content: z.string().nullable(),
  override_media_json: z.string().nullable(), // JSON string in DB
  override_options_json: z.string().nullable(), // JSON string in DB
  publish_status: PublishStatusSchema,
  remote_post_id: z.string().nullable(),
  failure_reason: z.string().nullable(),
  last_attempt_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type PlatformTargetRow = z.infer<typeof PlatformTargetRowSchema>;
