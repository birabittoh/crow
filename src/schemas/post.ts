import { z } from 'zod';
import { CreatePlatformTargetSchema } from './platform-target';

export const PostStatusSchema = z.enum([
  'scheduled',
  'publishing',
  'partially_published',
  'published',
  'failed',
]);
export type PostStatus = z.infer<typeof PostStatusSchema>;

export const CreatePostSchema = z.object({
  base_content: z.string().min(1, 'Content is required'),
  scheduled_at_utc: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  platform_targets: z.array(CreatePlatformTargetSchema).min(1, 'At least one platform target is required'),
  media_ids: z.array(z.string().uuid()).optional(),
});

export type CreatePost = z.infer<typeof CreatePostSchema>;

export const UpdatePostSchema = z.object({
  base_content: z.string().min(1).optional(),
  scheduled_at_utc: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' })
    .optional(),
  platform_targets: z.array(CreatePlatformTargetSchema).min(1).optional(),
  media_ids: z.array(z.string().uuid()).optional(),
});

export type UpdatePost = z.infer<typeof UpdatePostSchema>;

export const PostRowSchema = z.object({
  id: z.string().uuid(),
  base_content: z.string(),
  scheduled_at_utc: z.string(),
  status: PostStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export type PostRow = z.infer<typeof PostRowSchema>;
