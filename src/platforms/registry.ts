import { PlatformService } from './platform-service';
import { Platform } from '../schemas/platform-target';
import { config } from '../config';
import { TwitterService } from './twitter/twitter-service';
import { TelegramService } from './telegram/telegram-service';
import { InstagramService } from './instagram/instagram-service';
import { FacebookService } from './facebook/facebook-service';
import { MastodonService } from './mastodon/mastodon-service';
import { BlueskyService } from './bluesky/bluesky-service';

const platformFactories: Record<Platform, () => PlatformService> = {
  twitter: () => new TwitterService(config.twitter),
  telegram: () => new TelegramService(config.telegram),
  instagram: () => new InstagramService(config.instagram),
  facebook: () => new FacebookService(config.facebook),
  mastodon: () => new MastodonService(config.mastodon),
  bluesky: () => new BlueskyService(config.bluesky),
};

let platformInstances: Map<Platform, PlatformService> | null = null;

function initPlatforms(): Map<Platform, PlatformService> {
  const map = new Map<Platform, PlatformService>();
  for (const [name, factory] of Object.entries(platformFactories)) {
    const service = factory();
    if (service.isAvailable()) {
      map.set(name as Platform, service);
    }
  }
  return map;
}

export function getPlatforms(): Map<Platform, PlatformService> {
  if (!platformInstances) {
    platformInstances = initPlatforms();
  }
  return platformInstances;
}

export function getPlatformService(platform: Platform): PlatformService | undefined {
  return getPlatforms().get(platform);
}

export function getAvailablePlatforms(): Platform[] {
  return Array.from(getPlatforms().keys());
}
