import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),

  // Database
  postgres: process.env.POSTGRES_HOST
    ? {
        host: process.env.POSTGRES_HOST,
        port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
        database: process.env.POSTGRES_DB || 'crow',
        user: process.env.POSTGRES_USER || 'crow',
        password: process.env.POSTGRES_PASSWORD || '',
      }
    : null,

  usePostgres: !!process.env.POSTGRES_HOST,

  // Twitter
  twitter: process.env.TWITTER_API_KEY
    ? {
        apiKey: process.env.TWITTER_API_KEY!,
        apiSecret: process.env.TWITTER_API_SECRET!,
        accessToken: process.env.TWITTER_ACCESS_TOKEN!,
        accessSecret: process.env.TWITTER_ACCESS_SECRET!,
      }
    : null,

  // Telegram
  telegram: process.env.TELEGRAM_BOT_TOKEN
    ? {
        botToken: process.env.TELEGRAM_BOT_TOKEN!,
        channelId: process.env.TELEGRAM_CHANNEL_ID!,
      }
    : null,

  // Instagram
  instagram: process.env.INSTAGRAM_ACCESS_TOKEN
    ? {
        accessToken: process.env.INSTAGRAM_ACCESS_TOKEN!,
        accountId: process.env.INSTAGRAM_ACCOUNT_ID!,
      }
    : null,

  // Facebook
  facebook: process.env.FACEBOOK_PAGE_ACCESS_TOKEN
    ? {
        pageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN!,
        pageId: process.env.FACEBOOK_PAGE_ID!,
      }
    : null,

  // Mastodon
  mastodon: process.env.MASTODON_ACCESS_TOKEN
    ? {
        instanceUrl: process.env.MASTODON_INSTANCE_URL!,
        accessToken: process.env.MASTODON_ACCESS_TOKEN!,
      }
    : null,

  // Bluesky
  bluesky: process.env.BLUESKY_IDENTIFIER
    ? {
        service: process.env.BLUESKY_SERVICE || 'https://bsky.social',
        identifier: process.env.BLUESKY_IDENTIFIER!,
        password: process.env.BLUESKY_PASSWORD!,
      }
    : null,

  // Media
  mediaStoragePath: process.env.MEDIA_STORAGE_PATH || './uploads',

  // Scheduler
  schedulerPollIntervalMs: parseInt(process.env.SCHEDULER_POLL_INTERVAL_MS || '15000', 10),
  schedulerMaxRetries: parseInt(process.env.SCHEDULER_MAX_RETRIES || '3', 10),

  // Recurrent events (external URL exposed to frontend via /api/config)
  recurrentEventsUrl: process.env.RECURRENT_EVENTS_URL || '',
};
