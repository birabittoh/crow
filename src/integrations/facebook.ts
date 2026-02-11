import { PlatformIntegration, PlatformConstraints, PublishResult } from "./types";
import axios from "axios";

export class FacebookIntegration implements PlatformIntegration {
  id = "facebook";
  name = "Facebook";

  isEnabled(): boolean {
    return !!(process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_PAGE_ACCESS_TOKEN);
  }

  getConstraints(): PlatformConstraints {
    return {
      characterLimit: 63206,
      mediaSupport: {
        images: true,
        videos: true,
        maxImages: 10,
      },
    };
  }

  async publish(content: string, media?: any[]): Promise<PublishResult> {
    try {
      const pageId = process.env.FACEBOOK_PAGE_ID;
      const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${pageId}/feed`,
        {
          message: content,
          access_token: accessToken,
        }
      );

      return {
        success: true,
        platformPostId: response.data.id,
        metadata: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        errorMessage: error.response?.data?.error?.message || error.message,
      };
    }
  }
}
