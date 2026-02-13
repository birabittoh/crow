import { z } from 'zod';

export const THREADS_MAX_TEXT_LENGTH = 500;
export const THREADS_MAX_IMAGES = 20;
export const THREADS_MAX_VIDEO_LENGTH_SECONDS = 300; // 5 minutes
export const THREADS_GRAPH_API_BASE = 'https://graph.threads.net';

export const ThreadsPostValidationSchema = z.object({
  text: z.string(),
  hasMedia: z.boolean(),
}).refine(
  (data) => {
    return data.text.length <= THREADS_MAX_TEXT_LENGTH;
  },
  {
    message: 'Text exceeds Threads length limit',
  }
);
