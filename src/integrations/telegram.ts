import { PlatformIntegration, PlatformConstraints, PublishResult } from "./types";
import axios from "axios";

export class TelegramIntegration implements PlatformIntegration {
  id = "telegram";
  name = "Telegram";

  isEnabled(): boolean {
    return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  }

  getConstraints(): PlatformConstraints {
    return {
      characterLimit: 4096,
      mediaSupport: {
        images: true,
        videos: true,
        maxImages: 10,
      },
    };
  }

  async publish(content: string, media?: any[]): Promise<PublishResult> {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      const response = await axios.post(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          chat_id: chatId,
          text: content,
          parse_mode: "HTML",
        }
      );

      return {
        success: true,
        platformPostId: response.data.result.message_id.toString(),
        metadata: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        errorMessage: error.response?.data?.description || error.message,
      };
    }
  }
}
