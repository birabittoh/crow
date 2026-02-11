import { z } from 'zod';

export const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;
export const TELEGRAM_MAX_CAPTION_LENGTH = 1024;
export const TELEGRAM_MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10MB
export const TELEGRAM_MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

export const TelegramPostValidationSchema = z.object({
  text: z.string(),
  hasMedia: z.boolean(),
}).refine(
  (data) => {
    const limit = data.hasMedia ? TELEGRAM_MAX_CAPTION_LENGTH : TELEGRAM_MAX_MESSAGE_LENGTH;
    return data.text.length <= limit;
  },
  {
    message: 'Text exceeds Telegram length limit',
  }
);
