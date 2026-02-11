import TelegramBot from 'node-telegram-bot-api';
import {
  PlatformService,
  PublishContent,
  PublishResult,
  PlatformValidationError,
  PlatformError,
} from '../platform-service';
import { MediaAsset } from '../../schemas/media';
import {
  TELEGRAM_MAX_MESSAGE_LENGTH,
  TELEGRAM_MAX_CAPTION_LENGTH,
} from './telegram-schemas';
import fs from 'fs';

interface TelegramCredentials {
  botToken: string;
  channelId: string;
}

export class TelegramService implements PlatformService {
  readonly platformName = 'telegram';
  private bot: TelegramBot | null = null;
  private channelId: string = '';
  private credentials: TelegramCredentials | null;

  constructor(credentials: TelegramCredentials | null) {
    this.credentials = credentials;
    if (credentials) {
      this.bot = new TelegramBot(credentials.botToken);
      this.channelId = credentials.channelId;
    }
  }

  isAvailable(): boolean {
    return this.bot !== null && this.channelId !== '';
  }

  validatePost(content: PublishContent): PlatformValidationError[] {
    const errors: PlatformValidationError[] = [];
    const hasMedia = content.media.length > 0;
    const limit = hasMedia ? TELEGRAM_MAX_CAPTION_LENGTH : TELEGRAM_MAX_MESSAGE_LENGTH;

    if (content.text.length > limit) {
      errors.push({
        field: 'text',
        message: `Text exceeds Telegram ${hasMedia ? 'caption' : 'message'} limit of ${limit} characters`,
      });
    }

    return errors;
  }

  async uploadMedia(_asset: MediaAsset): Promise<string> {
    // Telegram doesn't require pre-uploading; media is sent inline with the message.
    // Return the storage path as the "media ID" for use in publishPost.
    return _asset.storage_path;
  }

  async publishPost(content: PublishContent, uploadedMediaIds: string[]): Promise<PublishResult> {
    if (!this.bot) throw new Error('Telegram bot not initialized');

    const options: TelegramBot.SendMessageOptions = {};
    const platformOptions = content.options;

    if (platformOptions.parse_mode) {
      options.parse_mode = platformOptions.parse_mode as 'MarkdownV2' | 'HTML';
    }
    if (platformOptions.disable_web_page_preview) {
      (options as any).disable_web_page_preview = true;
    }
    if (platformOptions.disable_notification) {
      options.disable_notification = true;
    }

    // No media: send text message
    if (uploadedMediaIds.length === 0) {
      const result = await this.bot.sendMessage(this.channelId, content.text, options);
      return { remotePostId: String(result.message_id) };
    }

    // Determine media type from the first asset
    const firstAsset = content.media[0];
    if (!firstAsset) {
      const result = await this.bot.sendMessage(this.channelId, content.text, options);
      return { remotePostId: String(result.message_id) };
    }

    if (firstAsset.type === 'image') {
      const photoPath = uploadedMediaIds[0];
      const result = await this.bot.sendPhoto(this.channelId, fs.createReadStream(photoPath) as any, {
        caption: content.text,
        parse_mode: options.parse_mode,
        disable_notification: options.disable_notification,
      });
      return { remotePostId: String(result.message_id) };
    }

    if (firstAsset.type === 'video') {
      const videoPath = uploadedMediaIds[0];
      const result = await this.bot.sendVideo(this.channelId, fs.createReadStream(videoPath) as any, {
        caption: content.text,
        parse_mode: options.parse_mode,
        disable_notification: options.disable_notification,
      });
      return { remotePostId: String(result.message_id) };
    }

    // Fallback: text only
    const result = await this.bot.sendMessage(this.channelId, content.text, options);
    return { remotePostId: String(result.message_id) };
  }

  mapError(error: unknown): PlatformError {
    if (error instanceof Error) {
      const message = error.message;
      const retryable =
        message.includes('429') ||
        message.includes('timeout') ||
        message.includes('ECONNRESET') ||
        message.includes('502') ||
        message.includes('503');

      return {
        code: 'TELEGRAM_ERROR',
        message: message.substring(0, 500),
        retryable,
      };
    }

    return {
      code: 'TELEGRAM_UNKNOWN_ERROR',
      message: String(error).substring(0, 500),
      retryable: false,
    };
  }

  supportsFeature(feature: string): boolean {
    const supported = ['text', 'images', 'video', 'parse_mode'];
    return supported.includes(feature);
  }
}
