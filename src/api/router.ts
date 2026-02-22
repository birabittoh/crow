import { Router } from 'express';
import { postsRouter } from './posts';
import { mediaRouter } from './media';
import { platformsRouter } from './platforms';
import { aiServicesRouter } from './ai-services';
import { getAvailablePlatforms, getAllPlatforms, getPlatformMetadata } from '../platforms/registry';
import { config } from '../config';
import { db } from '../db';

export const apiRouter = Router();

apiRouter.use('/posts', postsRouter);
apiRouter.use('/media', mediaRouter);
apiRouter.use('/platforms', platformsRouter);
apiRouter.use('/ai-services', aiServicesRouter);

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

  // Load AI services (masked keys) and default prompt
  let aiServices: any[] = [];
  let aiDefaultPrompt = '';
  try {
    const services = await db('ai_services').select('*').orderBy('name');
    aiServices = services.map((s) => ({
      id: s.id,
      name: s.name,
      model: s.model,
    }));
    const promptRow = await db('app_settings').where('key', 'ai_default_prompt').first();
    aiDefaultPrompt = promptRow?.value || '';
  } catch {
    // Tables may not exist yet before migration
  }

  res.json({
    platforms: availablePlatforms,
    allPlatforms,
    platformOptions,
    platformLimits,
    schedulerPollIntervalMs: config.schedulerPollIntervalMs,
    aiServices,
    aiDefaultPrompt,
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
