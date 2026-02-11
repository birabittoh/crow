import { PlatformIntegration, PlatformConstraints, PublishResult } from "./types";
import axios from "axios";

export class MastodonIntegration implements PlatformIntegration {
  id = "mastodon";
  name = "Mastodon";

  isEnabled(): boolean {
    return !!(process.env.MASTODON_ACCESS_TOKEN && process.env.MASTODON_INSTANCE_URL);
  }

  getConstraints(): PlatformConstraints {
    return {
      characterLimit: 500,
      mediaSupport: {
        images: true,
        videos: true,
        maxImages: 4,
      },
    };
  }

  async publish(content: string, media?: any[]): Promise<PublishResult> {
    try {
      const instanceUrl = process.env.MASTODON_INSTANCE_URL;
      const accessToken = process.env.MASTODON_ACCESS_TOKEN;

      // Simplistic implementation for now, focusing on text
      const response = await axios.post(
        `${instanceUrl}/api/v1/statuses`,
        { status: content },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
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
        errorMessage: error.response?.data?.error || error.message,
      };
    }
  }
}
