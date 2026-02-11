import TelegramBot from 'node-telegram-bot-api';
import {
  PlatformService,
  PublishContent,
  PublishResult,
  PlatformValidationError,
  PlatformError,
  OptionField,
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

  getOptionFields(): OptionField[] {
    return [
      {
        key: 'parse_mode',
        label: 'Parse Mode',
        type: 'enum',
        enumValues: ['MarkdownV2', 'HTML'],
        description: 'How to parse the message text',
      },
      {
        key: 'disable_web_page_preview',
        label: 'Disable Web Page Preview',
        type: 'boolean',
        description: 'Disables link previews in messages',
      },
      {
        key: 'disable_notification',
        label: 'Disable Notification',
        type: 'boolean',
        description: 'Sends the message silently',
      },
    ];
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

    const platformOptions = content.options;
    const parseMode = platformOptions.parse_mode as 'MarkdownV2' | 'HTML' | undefined;
    const disableNotification = !!platformOptions.disable_notification;

    // No media: send text message
    if (uploadedMediaIds.length === 0 || content.media.length === 0) {
      const msgOpts: TelegramBot.SendMessageOptions = {};
      if (parseMode) msgOpts.parse_mode = parseMode;
      if (platformOptions.disable_web_page_preview) {
        (msgOpts as any).disable_web_page_preview = true;
      }
      if (disableNotification) msgOpts.disable_notification = true;

      const result = await this.bot.sendMessage(this.channelId, content.text, msgOpts);
      return { remotePostId: String(result.message_id) };
    }

    // Single media item: use sendPhoto/sendVideo with caption
    if (uploadedMediaIds.length === 1) {
      const asset = content.media[0];
      const mediaPath = uploadedMediaIds[0];

      if (asset.type === 'image') {
        const result = await this.bot.sendPhoto(
          this.channelId,
          fs.createReadStream(mediaPath) as any,
          {
            caption: content.text || undefined,
            parse_mode: parseMode,
            disable_notification: disableNotification,
          }
        );
        return { remotePostId: String(result.message_id) };
      }

      const result = await this.bot.sendVideo(
        this.channelId,
        fs.createReadStream(mediaPath) as any,
        {
          caption: content.text || undefined,
          parse_mode: parseMode,
          disable_notification: disableNotification,
        }
      );
      return { remotePostId: String(result.message_id) };
    }

    // Multiple media: send as album via sendMediaGroup
    // Caption goes on the first item only
    const mediaGroupWithStreams = content.media.map((asset, i) => {
      const mediaPath = uploadedMediaIds[i];
      const item: Record<string, unknown> = {
        type: asset.type === 'image' ? 'photo' : 'video',
        media: fs.createReadStream(mediaPath),
      };
      if (i === 0 && content.text) {
        item.caption = content.text;
        if (parseMode) item.parse_mode = parseMode;
      }
      return item;
    });

    const results = await (this.bot as any).sendMediaGroup(
      this.channelId,
      mediaGroupWithStreams,
      { disable_notification: disableNotification }
    );

    // sendMediaGroup returns an array of Messages; use the first message_id
    const firstResult = Array.isArray(results) ? results[0] : results;
    return { remotePostId: String(firstResult.message_id) };
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
