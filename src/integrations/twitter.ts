import { PlatformIntegration, PlatformConstraints, PublishResult } from "./types";
import { TwitterApi } from "twitter-api-v2";

export class TwitterIntegration implements PlatformIntegration {
  id = "twitter";
  name = "Twitter (X)";

  isEnabled(): boolean {
    return !!(
      process.env.TWITTER_API_KEY &&
      process.env.TWITTER_API_SECRET &&
      process.env.TWITTER_ACCESS_TOKEN &&
      process.env.TWITTER_ACCESS_SECRET
    );
  }

  getConstraints(): PlatformConstraints {
    return {
      characterLimit: 280,
      mediaSupport: {
        images: true,
        videos: true,
        maxImages: 4,
      },
    };
  }

  async publish(content: string, media?: any[]): Promise<PublishResult> {
    try {
      const client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY!,
        appSecret: process.env.TWITTER_API_SECRET!,
        accessToken: process.env.TWITTER_ACCESS_TOKEN!,
        accessSecret: process.env.TWITTER_ACCESS_SECRET!,
      });

      const response = await client.v2.tweet(content);

      return {
        success: true,
        platformPostId: response.data.id,
        metadata: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        errorMessage: error.message,
      };
    }
  }
}
