import { PlatformIntegration, PlatformConstraints, PublishResult } from "./types";
import { BskyAgent } from "@atproto/api";

export class BlueskyIntegration implements PlatformIntegration {
  id = "bluesky";
  name = "Bluesky";

  isEnabled(): boolean {
    return !!(process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_PASSWORD);
  }

  getConstraints(): PlatformConstraints {
    return {
      characterLimit: 300,
      mediaSupport: {
        images: true,
        videos: false, // Videos are more complex on Bluesky
        maxImages: 4,
      },
    };
  }

  async publish(content: string, media?: any[]): Promise<PublishResult> {
    try {
      const agent = new BskyAgent({ service: "https://bsky.social" });
      await agent.login({
        identifier: process.env.BLUESKY_IDENTIFIER!,
        password: process.env.BLUESKY_PASSWORD!,
      });

      const response = await agent.post({
        text: content,
      });

      return {
        success: true,
        platformPostId: response.uri,
        metadata: response,
      };
    } catch (error: any) {
      return {
        success: false,
        errorMessage: error.message,
      };
    }
  }
}
