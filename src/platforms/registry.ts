import { PlatformService } from './platform-service';
import { Platform } from '../schemas/platform-target';
import { config } from '../config';
import { TwitterService } from './twitter/twitter-service';
import { TelegramService } from './telegram/telegram-service';

const platformFactories: Record<Platform, () => PlatformService> = {
  twitter: () => new TwitterService(config.twitter),
  telegram: () => new TelegramService(config.telegram),
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
