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

  // Media
  mediaStoragePath: process.env.MEDIA_STORAGE_PATH || './uploads',

  // Scheduler
  schedulerPollIntervalMs: parseInt(process.env.SCHEDULER_POLL_INTERVAL_MS || '15000', 10),
  schedulerMaxRetries: parseInt(process.env.SCHEDULER_MAX_RETRIES || '3', 10),

  // Recurrent events (fetched server-side and proxied via /api/recurrent-events)
  recurrentEventsUrl: process.env.RECURRENT_EVENTS_URL || '',
};
