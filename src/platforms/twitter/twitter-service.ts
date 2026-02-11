import { TwitterApi, EUploadMimeType } from 'twitter-api-v2';
import {
  PlatformService,
  PublishContent,
  PublishResult,
  PlatformValidationError,
  PlatformError,
  OptionField,
  CharacterLimits,
} from '../platform-service';
import { MediaAsset } from '../../schemas/media';
import {
  TWITTER_MAX_CHARS,
  TWITTER_MAX_IMAGES,
  TWITTER_MAX_VIDEOS,
} from './twitter-schemas';
import fs from 'fs';

interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

export class TwitterService implements PlatformService {
  readonly platformName = 'twitter';
  private client: TwitterApi | null = null;
  private credentials: TwitterCredentials | null;

  constructor(credentials: TwitterCredentials | null) {
    this.credentials = credentials;
    if (credentials) {
      this.client = new TwitterApi({
        appKey: credentials.apiKey,
        appSecret: credentials.apiSecret,
        accessToken: credentials.accessToken,
        accessSecret: credentials.accessSecret,
      });
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  getOptionFields(): OptionField[] {
    return [
      {
        key: 'reply_to_tweet_id',
        label: 'Reply To Tweet ID',
        type: 'string',
        description: 'ID of the tweet to reply to',
      },
      {
        key: 'quote_tweet_id',
        label: 'Quote Tweet ID',
        type: 'string',
        description: 'ID of the tweet to quote',
      },
    ];
  }

  getCharacterLimits(): CharacterLimits {
    return { maxChars: TWITTER_MAX_CHARS };
  }

  validatePost(content: PublishContent): PlatformValidationError[] {
    const errors: PlatformValidationError[] = [];

    if (content.text.length > TWITTER_MAX_CHARS) {
      errors.push({
        field: 'text',
        message: `Tweet exceeds ${TWITTER_MAX_CHARS} character limit (${content.text.length} chars)`,
      });
    }

    const images = content.media.filter((m) => m.type === 'image');
    const videos = content.media.filter((m) => m.type === 'video');

    if (images.length > TWITTER_MAX_IMAGES) {
      errors.push({
        field: 'media',
        message: `Maximum ${TWITTER_MAX_IMAGES} images per tweet`,
      });
    }

    if (videos.length > TWITTER_MAX_VIDEOS) {
      errors.push({
        field: 'media',
        message: `Maximum ${TWITTER_MAX_VIDEOS} video per tweet`,
      });
    }

    if (images.length > 0 && videos.length > 0) {
      errors.push({
        field: 'media',
        message: 'Cannot mix images and videos in a single tweet',
      });
    }

    return errors;
  }

  async uploadMedia(asset: MediaAsset): Promise<string> {
    if (!this.client) throw new Error('Twitter client not initialized');

    const mimeMap: Record<string, EUploadMimeType> = {
      'image/jpeg': EUploadMimeType.Jpeg,
      'image/png': EUploadMimeType.Png,
      'image/webp': EUploadMimeType.Webp,
      'video/mp4': EUploadMimeType.Mp4,
    };

    const mimeType = mimeMap[asset.mime_type];
    if (!mimeType) {
      throw new Error(`Unsupported MIME type for Twitter: ${asset.mime_type}`);
    }

    const mediaId = await this.client.v1.uploadMedia(asset.storage_path, {
      mimeType,
      additionalOwners: [],
    });

    return mediaId;
  }

  async publishPost(content: PublishContent, uploadedMediaIds: string[]): Promise<PublishResult> {
    if (!this.client) throw new Error('Twitter client not initialized');

    const tweetPayload: Record<string, unknown> = {
      text: content.text,
    };

    if (uploadedMediaIds.length > 0) {
      tweetPayload.media = {
        media_ids: uploadedMediaIds,
      };
    }

    const options = content.options;
    if (options.reply_to_tweet_id) {
      tweetPayload.reply = { in_reply_to_tweet_id: options.reply_to_tweet_id as string };
    }
    if (options.quote_tweet_id) {
      tweetPayload.quote_tweet_id = options.quote_tweet_id;
    }

    const result = await this.client.v2.tweet(tweetPayload as any);

    return {
      remotePostId: result.data.id,
    };
  }

  mapError(error: unknown): PlatformError {
    if (error instanceof Error) {
      const message = error.message;
      const retryable =
        message.includes('Rate limit') ||
        message.includes('timeout') ||
        message.includes('ECONNRESET') ||
        message.includes('503');

      return {
        code: 'TWITTER_ERROR',
        message: message.substring(0, 500),
        retryable,
      };
    }

    return {
      code: 'TWITTER_UNKNOWN_ERROR',
      message: String(error).substring(0, 500),
      retryable: false,
    };
  }

  supportsFeature(feature: string): boolean {
    const supported = ['text', 'images', 'video', 'reply', 'quote'];
    return supported.includes(feature);
  }
}
