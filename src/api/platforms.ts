import { Router, Request, Response } from 'express';
import { TwitterApi } from 'twitter-api-v2';
import { PlatformSchema } from '../schemas/platform-target';
import {
  getAllPlatforms,
  getAvailablePlatforms,
  getPlatformMetadata,
  validatePlatformCredentials,
  savePlatformCredentials,
  deletePlatformCredentials,
} from '../platforms/registry';
import { db } from '../db';

export const platformsRouter = Router();

const twitterOAuthState = new Map<string, { secret: string; apiKey: string; apiSecret: string; origin: string }>();

platformsRouter.post('/twitter/oauth/authorize', async (req: Request, res: Response) => {
  const { apiKey, apiSecret, origin } = req.body;
  if (!apiKey || !apiSecret) {
    res.status(400).json({ error: 'Missing apiKey or apiSecret' });
    return;
  }

  try {
    const client = new TwitterApi({
      appKey: apiKey as string,
      appSecret: apiSecret as string,
    });

    // Use current request to determine base URL for callback
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const callbackUrl = `${protocol}://${host}/api/platforms/twitter/oauth/callback`;

    const { url, oauth_token, oauth_token_secret } = await client.generateAuthLink(callbackUrl);

    twitterOAuthState.set(oauth_token, {
      secret: oauth_token_secret,
      apiKey: apiKey as string,
      apiSecret: apiSecret as string,
      origin: origin as string || '*',
    });

    // Cleanup old state after 15 minutes
    setTimeout(() => twitterOAuthState.delete(oauth_token), 15 * 60 * 1000);

    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

platformsRouter.get('/twitter/oauth/callback', async (req: Request, res: Response) => {
  const { oauth_token, oauth_verifier } = req.query;

  if (!oauth_token || !oauth_verifier) {
    res.send(`
      <html><body><script>
        window.opener.postMessage({ type: 'TWITTER_OAUTH_ERROR', error: 'Missing tokens' }, '*');
        window.close();
      </script></body></html>
    `);
    return;
  }

  const state = twitterOAuthState.get(oauth_token as string);
  if (!state) {
    res.send(`
      <html><body><script>
        window.opener.postMessage({ type: 'TWITTER_OAUTH_ERROR', error: 'Invalid or expired session' }, '*');
        window.close();
      </script></body></html>
    `);
    return;
  }

  try {
    const client = new TwitterApi({
      appKey: state.apiKey,
      appSecret: state.apiSecret,
      accessToken: oauth_token as string,
      accessSecret: state.secret,
    });

    const { accessToken, accessSecret } = await client.login(oauth_verifier as string);

    twitterOAuthState.delete(oauth_token as string);

    res.send(`
      <html><body><script>
        window.opener.postMessage({
          type: 'TWITTER_OAUTH_SUCCESS',
          accessToken: '${accessToken}',
          accessSecret: '${accessSecret}'
        }, ${JSON.stringify(state.origin)});
        window.close();
      </script></body></html>
    `);
  } catch (error: any) {
    res.send(`
      <html><body><script>
        window.opener.postMessage({ type: 'TWITTER_OAUTH_ERROR', error: ${JSON.stringify(error.message)} }, ${JSON.stringify(state.origin)});
        window.close();
      </script></body></html>
    `);
  }
});

// List all platforms with their configuration status and credential fields
platformsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const allPlatforms = getAllPlatforms();
    const availablePlatforms = await getAvailablePlatforms();

    // Get all credentials from DB to include them in the response for pre-filling
    const credentialRows = await db('platform_credentials').select('platform', 'credentials_json');
    const credentialsMap = new Map(
      credentialRows.map((row) => [row.platform, JSON.parse(row.credentials_json)])
    );

    const result = allPlatforms.map((platform) => {
      const meta = getPlatformMetadata(platform);
      return {
        platform,
        configured: availablePlatforms.includes(platform),
        credentialFields: meta.credentialFields,
        currentCredentials: credentialsMap.get(platform) || null,
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

    // Attempt to validate credentials before saving
    try {
      await validatePlatformCredentials(platform, credentials);
    } catch (error: any) {
      res.status(400).json({
        error: `Validation failed: ${error.message}`,
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
