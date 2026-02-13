import {
  PlatformService,
  PublishContent,
  PublishResult,
  PlatformValidationError,
  PlatformError,
  OptionField,
  CharacterLimits,
  CredentialField,
} from '../platform-service';
import { MediaAsset } from '../../schemas/media';
import {
  THREADS_MAX_TEXT_LENGTH,
  THREADS_MAX_IMAGES,
  THREADS_GRAPH_API_BASE,
} from './threads-schemas';

interface ThreadsCredentials {
  accessToken: string;
  userId: string;
}

interface GraphApiError {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
  };
}

export class ThreadsService implements PlatformService {
  readonly platformName = 'threads';
  private credentials: ThreadsCredentials | null;

  constructor(credentials: ThreadsCredentials | null) {
    this.credentials = credentials;
  }

  getCredentialFields(): CredentialField[] {
    return [
      {
        key: 'accessToken',
        label: 'Access Token',
        type: 'password',
        placeholder: 'Threads API access token',
      },
      {
        key: 'userId',
        label: 'User ID',
        type: 'text',
        placeholder: 'Your Threads user ID',
      },
    ];
  }

  isAvailable(): boolean {
    return this.credentials !== null;
  }

  getOptionFields(): OptionField[] {
    return [
      {
        key: 'reply_to',
        label: 'Reply to Thread ID',
        type: 'string',
        description: 'Reply to a specific thread',
        required: false,
      },
      {
        key: 'reply_control',
        label: 'Reply Control',
        type: 'enum',
        enumValues: ['everyone', 'accounts_you_follow', 'mentioned_only'],
        description: 'Who can reply to this thread',
        required: false,
      },
    ];
  }

  getCharacterLimits(): CharacterLimits {
    return {
      maxChars: THREADS_MAX_TEXT_LENGTH,
    };
  }

  validatePost(content: PublishContent): PlatformValidationError[] {
    const errors: PlatformValidationError[] = [];

    if (content.text.trim().length === 0 && content.media.length === 0) {
      errors.push({
        field: 'content',
        message: 'Threads requires either text or media',
      });
    }

    if (content.text.length > THREADS_MAX_TEXT_LENGTH) {
      errors.push({
        field: 'text',
        message: `Text exceeds Threads limit of ${THREADS_MAX_TEXT_LENGTH} characters`,
      });
    }

    const images = content.media.filter((m) => m.type === 'image');
    if (images.length > THREADS_MAX_IMAGES) {
      errors.push({
        field: 'media',
        message: `Threads allows a maximum of ${THREADS_MAX_IMAGES} images per post`,
      });
    }

    // Threads doesn't support mixing images and videos
    const videos = content.media.filter((m) => m.type === 'video');
    if (videos.length > 0 && images.length > 0) {
      errors.push({
        field: 'media',
        message: 'Threads does not support mixing images and videos in the same post',
      });
    }

    if (videos.length > 1) {
      errors.push({
        field: 'media',
        message: 'Threads allows only one video per post',
      });
    }

    return errors;
  }

  async uploadMedia(asset: MediaAsset): Promise<string> {
    // Threads doesn't require pre-uploading; media URLs are passed during container creation
    // Return the storage path as the "media ID"
    return asset.storage_path;
  }

  async publishPost(content: PublishContent, uploadedMediaIds: string[]): Promise<PublishResult> {
    if (!this.credentials) throw new Error('Threads not configured');

    const { accessToken, userId } = this.credentials;
    const replyTo = content.options.reply_to as string | undefined;
    const replyControl = content.options.reply_control as string | undefined;

    // Step 1: Create media container
    const params = new URLSearchParams({
      access_token: accessToken,
    });

    if (content.text) {
      params.set('text', content.text);
    }

    // Handle media
    if (uploadedMediaIds.length > 0 && content.media.length > 0) {
      const hasVideo = content.media.some((m) => m.type === 'video');

      if (hasVideo) {
        // Single video post
        params.set('media_type', 'VIDEO');
        params.set('video_url', uploadedMediaIds[0]);
      } else if (uploadedMediaIds.length === 1) {
        // Single image post
        params.set('media_type', 'IMAGE');
        params.set('image_url', uploadedMediaIds[0]);
      } else {
        // Carousel (multiple images)
        params.set('media_type', 'CAROUSEL');

        // Create child containers for each image
        const childIds: string[] = [];
        for (const mediaPath of uploadedMediaIds) {
          const childParams = new URLSearchParams({
            access_token: accessToken,
            media_type: 'IMAGE',
            image_url: mediaPath,
            is_carousel_item: 'true',
          });

          const childRes = await fetch(
            `${THREADS_GRAPH_API_BASE}/v1.0/${userId}/threads`,
            {
              method: 'POST',
              body: childParams,
            }
          );

          const childData = await childRes.json() as { id?: string } & GraphApiError;
          if (!childData.id) {
            throw new Error(
              `Failed to create carousel item: ${childData.error?.message || JSON.stringify(childData)}`
            );
          }
          childIds.push(childData.id);
        }

        params.set('children', childIds.join(','));
      }
    } else {
      // Text-only post
      params.set('media_type', 'TEXT');
    }

    // Add optional parameters
    if (replyTo) {
      params.set('reply_to_id', replyTo);
    }

    if (replyControl) {
      params.set('reply_control', replyControl);
    }

    // Create the media container
    const containerRes = await fetch(
      `${THREADS_GRAPH_API_BASE}/v1.0/${userId}/threads`,
      {
        method: 'POST',
        body: params,
      }
    );

    const containerData = await containerRes.json() as { id?: string } & GraphApiError;
    if (!containerData.id) {
      throw new Error(
        `Failed to create Threads container: ${containerData.error?.message || JSON.stringify(containerData)}`
      );
    }

    const containerId = containerData.id;

    // Step 2: For video, wait for processing
    if (content.media.length > 0 && content.media[0].type === 'video') {
      await this.waitForMediaReady(containerId, accessToken, userId);
    }

    // Step 3: Publish the container
    const publishParams = new URLSearchParams({
      creation_id: containerId,
      access_token: accessToken,
    });

    const publishRes = await fetch(
      `${THREADS_GRAPH_API_BASE}/v1.0/${userId}/threads_publish`,
      {
        method: 'POST',
        body: publishParams,
      }
    );

    const publishData = await publishRes.json() as { id?: string } & GraphApiError;
    if (!publishData.id) {
      throw new Error(
        `Failed to publish Threads post: ${publishData.error?.message || JSON.stringify(publishData)}`
      );
    }

    return { remotePostId: publishData.id };
  }

  async verifyCredentials(): Promise<void> {
    if (!this.credentials) throw new Error('Threads not configured');
    const { accessToken, userId } = this.credentials;

    const res = await fetch(
      `${THREADS_GRAPH_API_BASE}/v1.0/${userId}?fields=id,username&access_token=${accessToken}`
    );
    const data = (await res.json()) as { id?: string } & GraphApiError;

    if (!data.id) {
      throw new Error(
        `Threads validation failed: ${data.error?.message || 'Invalid User ID or Access Token'}`
      );
    }
  }

  mapError(error: unknown): PlatformError {
    if (error instanceof Error) {
      const message = error.message;
      // Graph API rate-limit codes: 4 (app-level), 32 (page-level)
      const retryable =
        message.includes('"code":4') ||
        message.includes('"code":32') ||
        message.includes('timeout') ||
        message.includes('ECONNRESET') ||
        message.includes('503');

      return {
        code: 'THREADS_ERROR',
        message: message.substring(0, 500),
        retryable,
      };
    }

    return {
      code: 'THREADS_UNKNOWN_ERROR',
      message: String(error).substring(0, 500),
      retryable: false,
    };
  }

  supportsFeature(feature: string): boolean {
    const supported = ['text', 'images', 'video', 'carousel', 'replies'];
    return supported.includes(feature);
  }

  // --- Private helpers ---

  private async waitForMediaReady(
    containerId: string,
    accessToken: string,
    userId: string,
    maxWaitMs: number = 60_000
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const res = await fetch(
        `${THREADS_GRAPH_API_BASE}/v1.0/${containerId}?fields=status&access_token=${accessToken}`
      );
      const data = await res.json() as { status?: string } & GraphApiError;

      if (data.status === 'FINISHED') return;
      if (data.status === 'ERROR') {
        throw new Error('Threads media processing failed');
      }

      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error('Timed out waiting for Threads media processing');
  }
}
