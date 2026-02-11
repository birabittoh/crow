import { PlatformIntegration, PlatformConstraints, PublishResult } from "./types";
import axios from "axios";

export class InstagramIntegration implements PlatformIntegration {
  id = "instagram";
  name = "Instagram";

  isEnabled(): boolean {
    return !!(
      process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID &&
      process.env.FACEBOOK_PAGE_ACCESS_TOKEN
    );
  }

  getConstraints(): PlatformConstraints {
    return {
      characterLimit: 2200,
      mediaSupport: {
        images: true,
        videos: true,
        maxImages: 10,
      },
    };
  }

  async publish(content: string, media?: any[]): Promise<PublishResult> {
    // Instagram publishing requires a media object (image or video)
    // For now, if no media is provided, we might fail or post text-only if possible (IG doesn't support text-only feed posts)
    if (!media || media.length === 0) {
      return {
        success: false,
        errorMessage: "Instagram requires at least one image or video.",
      };
    }

    try {
      const igId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
      const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

      // This is a simplified version. IG publishing is a multi-step process:
      // 1. Create media container
      // 2. Publish media container

      // Let's assume media[0] is a URL for simplicity in this implementation
      const mediaUrl = media[0].url;

      const containerResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${igId}/media`,
        {
          image_url: mediaUrl,
          caption: content,
          access_token: accessToken,
        }
      );

      const creationId = containerResponse.data.id;

      const publishResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${igId}/media_publish`,
        {
          creation_id: creationId,
          access_token: accessToken,
        }
      );

      return {
        success: true,
        platformPostId: publishResponse.data.id,
        metadata: publishResponse.data,
      };
    } catch (error: any) {
      return {
        success: false,
        errorMessage: error.response?.data?.error?.message || error.message,
      };
    }
  }
}
