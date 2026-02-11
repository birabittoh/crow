import { z } from 'zod';

export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ALLOWED_VIDEO_MIMES = ['video/mp4'] as const;
export const ALL_ALLOWED_MIMES = [...ALLOWED_IMAGE_MIMES, ...ALLOWED_VIDEO_MIMES] as const;

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_VIDEO_SIZE_BYTES = 512 * 1024 * 1024; // 512MB

export const MediaTypeSchema = z.enum(['image', 'video']);

export const MediaAssetSchema = z.object({
  id: z.string().uuid(),
  post_id: z.string().uuid().nullable().optional(),
  type: MediaTypeSchema,
  storage_path: z.string(),
  mime_type: z.string(),
  size_bytes: z.number().int().positive(),
  duration_seconds: z.number().nullable().optional(),
  file_hash: z.string().nullable().optional(),
  original_filename: z.string().nullable().optional(),
  created_at: z.string(),
});

export type MediaAsset = z.infer<typeof MediaAssetSchema>;

export const OverrideMediaItemSchema = z.object({
  media_asset_id: z.string().uuid(),
});

export const OverrideMediaSchema = z.array(OverrideMediaItemSchema);

export type OverrideMedia = z.infer<typeof OverrideMediaSchema>;
