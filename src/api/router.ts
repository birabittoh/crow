import { Router } from 'express';
import { postsRouter } from './posts';
import { mediaRouter } from './media';
import { platformsRouter } from './platforms';
import { getAvailablePlatforms, getAllPlatforms, getPlatformMetadata } from '../platforms/registry';
import { config } from '../config';

export const apiRouter = Router();

apiRouter.use('/posts', postsRouter);
apiRouter.use('/media', mediaRouter);
apiRouter.use('/platforms', platformsRouter);

// Frontend config endpoint — exposes only safe, non-secret configuration
apiRouter.get('/config', async (_req, res) => {
  const availablePlatforms = await getAvailablePlatforms();
  const allPlatforms = getAllPlatforms();

  const platformOptions: Record<string, any> = {};
  const platformLimits: Record<string, any> = {};

  for (const p of allPlatforms) {
    const meta = getPlatformMetadata(p);
    platformOptions[p] = meta.optionFields;
    platformLimits[p] = meta.characterLimits;
  }

  res.json({
    platforms: availablePlatforms,
    allPlatforms,
    platformOptions,
    platformLimits,
    schedulerPollIntervalMs: config.schedulerPollIntervalMs,
  });
});

// Recurrent events — proxied from external URL
apiRouter.get('/recurrent-events', async (_req, res) => {
  const url = config.recurrentEventsUrl;
  if (!url) {
    return res.json([]);
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(502).json({ error: `Upstream returned ${response.status}` });
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to fetch recurrent events' });
  }
});
