import { Router } from 'express';
import { postsRouter } from './posts';
import { mediaRouter } from './media';
import { getAvailablePlatforms, getPlatformService } from '../platforms/registry';
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
  const platforms = getAvailablePlatforms();

  const platformOptions: Record<string, ReturnType<NonNullable<ReturnType<typeof getPlatformService>>['getOptionFields']>> = {};
  const platformLimits: Record<string, { maxChars: number; maxCharsWithMedia?: number }> = {};
  for (const p of platforms) {
    const service = getPlatformService(p);
    if (service) {
      platformOptions[p] = service.getOptionFields();
      platformLimits[p] = service.getCharacterLimits();
    }
  }

  res.json({
    platforms,
    platformOptions,
    platformLimits,
    schedulerPollIntervalMs: config.schedulerPollIntervalMs,
    recurrentEventsUrl: config.recurrentEventsUrl || null,
  });
});
