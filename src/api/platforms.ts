import { Router, Request, Response } from 'express';
import { PlatformSchema } from '../schemas/platform-target';
import {
  getAllPlatforms,
  getAvailablePlatforms,
  getPlatformMetadata,
  savePlatformCredentials,
  deletePlatformCredentials,
} from '../platforms/registry';
import { db } from '../db';

export const platformsRouter = Router();

// List all platforms with their configuration status and credential fields
platformsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const allPlatforms = getAllPlatforms();
    const availablePlatforms = await getAvailablePlatforms();

    const result = allPlatforms.map((platform) => {
      const meta = getPlatformMetadata(platform);
      return {
        platform,
        configured: availablePlatforms.includes(platform),
        credentialFields: meta.credentialFields,
      };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Save credentials for a platform
platformsRouter.put('/:platform', async (req: Request, res: Response) => {
  try {
    const parseResult = PlatformSchema.safeParse(req.params.platform);
    if (!parseResult.success) {
      res.status(400).json({ error: `Unknown platform: ${req.params.platform}` });
      return;
    }
    const platform = parseResult.data;

    const credentials = req.body as Record<string, string>;
    if (!credentials || typeof credentials !== 'object') {
      res.status(400).json({ error: 'Request body must be an object of credential key-value pairs' });
      return;
    }

    // Validate that required credential fields are present
    const meta = getPlatformMetadata(platform);
    const missing = meta.credentialFields
      .filter((f) => f.required !== false)
      .filter((f) => !credentials[f.key] || credentials[f.key].trim() === '');

    if (missing.length > 0) {
      res.status(400).json({
        error: `Missing required credentials: ${missing.map((f) => f.label).join(', ')}`,
      });
      return;
    }

    await savePlatformCredentials(platform, credentials);

    res.json({ success: true, platform });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Remove credentials for a platform
platformsRouter.delete('/:platform', async (req: Request, res: Response) => {
  try {
    const parseResult = PlatformSchema.safeParse(req.params.platform);
    if (!parseResult.success) {
      res.status(400).json({ error: `Unknown platform: ${req.params.platform}` });
      return;
    }
    const platform = parseResult.data;

    await deletePlatformCredentials(platform);

    res.json({ success: true, platform });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});
