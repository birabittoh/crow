import { Router } from 'express';
import { postsRouter } from './posts';
import { mediaRouter } from './media';
import { getAvailablePlatforms } from '../platforms/registry';
import { config } from '../config';

export const apiRouter = Router();

apiRouter.use('/posts', postsRouter);
apiRouter.use('/media', mediaRouter);

// Available platforms
apiRouter.get('/platforms', (_req, res) => {
  const platforms = getAvailablePlatforms();
  res.json({ platforms });
});

// Frontend config endpoint — exposes only safe, non-secret configuration
apiRouter.get('/config', (_req, res) => {
  res.json({
    platforms: getAvailablePlatforms(),
    schedulerPollIntervalMs: config.schedulerPollIntervalMs,
    recurrentEventsUrl: config.recurrentEventsUrl || null,
  });
});
