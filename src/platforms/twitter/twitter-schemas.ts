import { z } from 'zod';

export const TWITTER_MAX_CHARS = 280;
export const TWITTER_MAX_IMAGES = 4;
export const TWITTER_MAX_VIDEOS = 1;
export const TWITTER_MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const TWITTER_MAX_VIDEO_SIZE = 512 * 1024 * 1024; // 512MB

export const TwitterPostValidationSchema = z.object({
  text: z.string().max(TWITTER_MAX_CHARS, `Tweet must be ${TWITTER_MAX_CHARS} characters or less`),
  imageCount: z.number().int().min(0).max(TWITTER_MAX_IMAGES),
  videoCount: z.number().int().min(0).max(TWITTER_MAX_VIDEOS),
}).refine(
  (data) => !(data.imageCount > 0 && data.videoCount > 0),
  { message: 'Cannot mix images and videos in a single tweet' }
);
