import { PlatformIntegration } from "./types";
import { MastodonIntegration } from "./mastodon";
import { BlueskyIntegration } from "./bluesky";
import { TelegramIntegration } from "./telegram";
import { TwitterIntegration } from "./twitter";
import { FacebookIntegration } from "./facebook";
import { InstagramIntegration } from "./instagram";

const integrations: PlatformIntegration[] = [
  new MastodonIntegration(),
  new BlueskyIntegration(),
  new TelegramIntegration(),
  new TwitterIntegration(),
  new FacebookIntegration(),
  new InstagramIntegration(),
];

export function getEnabledPlatforms(): PlatformIntegration[] {
  return integrations.filter((i) => i.isEnabled());
}

export function getPlatform(id: string): PlatformIntegration | undefined {
  return integrations.find((i) => i.id === id);
}
