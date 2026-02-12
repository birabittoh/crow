import { PlatformService, CredentialField } from './platform-service';
import { Platform } from '../schemas/platform-target';
import { db } from '../db';
import { TwitterService } from './twitter/twitter-service';
import { TelegramService } from './telegram/telegram-service';
import { InstagramService } from './instagram/instagram-service';
import { FacebookService } from './facebook/facebook-service';
import { MastodonService } from './mastodon/mastodon-service';
import { BlueskyService } from './bluesky/bluesky-service';

/** All known platforms and their factory functions. Credentials come from DB. */
const platformFactories: Record<Platform, (creds: any) => PlatformService> = {
  twitter: (c) => new TwitterService(c),
  telegram: (c) => new TelegramService(c),
  instagram: (c) => new InstagramService(c),
  facebook: (c) => new FacebookService(c),
  mastodon: (c) => new MastodonService(c),
  bluesky: (c) => new BlueskyService(c),
};

/** Create a platform service with null credentials (for metadata like credential fields) */
function createUnconfiguredService(platform: Platform): PlatformService {
  return platformFactories[platform](null);
}

/** All supported platform names */
export function getAllPlatforms(): Platform[] {
  return Object.keys(platformFactories) as Platform[];
}

/** Get credential field definitions for a platform (no DB needed) */
export function getPlatformCredentialFields(platform: Platform): CredentialField[] {
  return createUnconfiguredService(platform).getCredentialFields();
}

/** Load credentials for a specific platform from DB and create a live service */
export async function getPlatformService(platform: Platform): Promise<PlatformService | undefined> {
  const row = await db('platform_credentials').where('platform', platform).first();
  if (!row) return undefined;

  try {
    const creds = JSON.parse(row.credentials_json);
    const service = platformFactories[platform](creds);
    if (!service.isAvailable()) return undefined;
    return service;
  } catch {
    return undefined;
  }
}

/** Get all currently configured (available) platforms from DB */
export async function getAvailablePlatforms(): Promise<Platform[]> {
  const rows = await db('platform_credentials').select('platform', 'credentials_json');
  const available: Platform[] = [];

  for (const row of rows) {
    const platform = row.platform as Platform;
    if (platformFactories[platform]) {
      try {
        const creds = JSON.parse(row.credentials_json);
        const service = platformFactories[platform](creds);
        if (service.isAvailable()) {
          available.push(platform);
        }
      } catch {
        // skip invalid entries
      }
    }
  }

  return available;
}

/** Validate credentials for a platform by attempting to use them */
export async function validatePlatformCredentials(platform: Platform, credentials: Record<string, string>): Promise<void> {
  const service = platformFactories[platform](credentials);
  await service.verifyCredentials();
}

/** Save credentials for a platform into the DB */
export async function savePlatformCredentials(platform: Platform, credentials: Record<string, string>): Promise<void> {
  const json = JSON.stringify(credentials);
  const now = new Date().toISOString();

  const existing = await db('platform_credentials').where('platform', platform).first();
  if (existing) {
    await db('platform_credentials').where('platform', platform).update({
      credentials_json: json,
      updated_at: now,
    });
  } else {
    await db('platform_credentials').insert({
      platform,
      credentials_json: json,
      created_at: now,
      updated_at: now,
    });
  }
}

/** Remove credentials for a platform from the DB */
export async function deletePlatformCredentials(platform: Platform): Promise<void> {
  await db('platform_credentials').where('platform', platform).delete();
}

/** Get platform metadata (options, limits, credential fields) without requiring active credentials */
export function getPlatformMetadata(platform: Platform) {
  const service = createUnconfiguredService(platform);
  return {
    platform,
    credentialFields: service.getCredentialFields(),
    optionFields: service.getOptionFields(),
    characterLimits: service.getCharacterLimits(),
  };
}
