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
  INSTAGRAM_MAX_CAPTION_LENGTH,
  INSTAGRAM_MAX_IMAGES,
  INSTAGRAM_GRAPH_API_BASE,
} from './instagram-schemas';
import fs from 'fs';
import path from 'path';

interface InstagramCredentials {
  accessToken: string;
  accountId: string;
}

interface GraphApiError {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
  };
}

export class InstagramService implements PlatformService {
  readonly platformName = 'instagram';
  private credentials: InstagramCredentials | null;

  constructor(credentials: InstagramCredentials | null) {
    this.credentials = credentials;
  }

  isAvailable(): boolean {
    return this.credentials !== null;
  }

  getOptionFields(): OptionField[] {
    return [
      {
        key: 'location_id',
        label: 'Location ID',
        type: 'string',
        description: 'Facebook Place ID to tag the post with a location',
      },
    ];
  }

  getCharacterLimits(): CharacterLimits {
    return {
      maxChars: INSTAGRAM_MAX_CAPTION_LENGTH,
    };
  }

  validatePost(content: PublishContent): PlatformValidationError[] {
    const errors: PlatformValidationError[] = [];

    if (content.media.length === 0) {
      errors.push({
        field: 'media',
        message: 'Instagram requires at least one image or video',
      });
    }

    if (content.text.length > INSTAGRAM_MAX_CAPTION_LENGTH) {
      errors.push({
        field: 'text',
        message: `Caption exceeds Instagram limit of ${INSTAGRAM_MAX_CAPTION_LENGTH} characters`,
      });
    }

    if (content.media.length > INSTAGRAM_MAX_IMAGES) {
      errors.push({
        field: 'media',
        message: `Instagram allows a maximum of ${INSTAGRAM_MAX_IMAGES} media items per carousel`,
      });
    }

    return errors;
  }

  async uploadMedia(asset: MediaAsset): Promise<string> {
    if (!this.credentials) throw new Error('Instagram not configured');

    const { accessToken, accountId } = this.credentials;
    const isVideo = asset.type === 'video';

    // Instagram Graph API requires a publicly accessible URL for media.
    // For local files we need to upload them first. The media container
    // creation will be done during publishPost. Return the storage path
    // so publishPost can reference it.
    return asset.storage_path;
  }

  async publishPost(content: PublishContent, uploadedMediaIds: string[]): Promise<PublishResult> {
    if (!this.credentials) throw new Error('Instagram not configured');

    const { accessToken, accountId } = this.credentials;
    const locationId = content.options.location_id as string | undefined;

    if (uploadedMediaIds.length === 1) {
      // Single image or video post
      const containerId = await this.createMediaContainer(
        accountId,
        accessToken,
        content.media[0],
        uploadedMediaIds[0],
        content.text,
        locationId,
      );

      if (content.media[0].type === 'video') {
        await this.waitForMediaReady(containerId, accessToken);
      }

      return await this.publishContainer(accountId, accessToken, containerId);
    }

    // Carousel post (multiple media items)
    const childIds: string[] = [];
    for (let i = 0; i < content.media.length; i++) {
      const childId = await this.createMediaContainer(
        accountId,
        accessToken,
        content.media[i],
        uploadedMediaIds[i],
        undefined, // caption only on the carousel container
        undefined,
        true,
      );

      if (content.media[i].type === 'video') {
        await this.waitForMediaReady(childId, accessToken);
      }

      childIds.push(childId);
    }

    // Create carousel container
    const params = new URLSearchParams({
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      access_token: accessToken,
    });
    if (content.text) params.set('caption', content.text);
    if (locationId) params.set('location_id', locationId);

    const carouselRes = await fetch(
      `${INSTAGRAM_GRAPH_API_BASE}/${accountId}/media?${params}`,
      { method: 'POST' },
    );
    const carouselData = await carouselRes.json() as { id?: string } & GraphApiError;
    if (!carouselData.id) {
      throw new Error(
        `Failed to create carousel container: ${carouselData.error?.message || JSON.stringify(carouselData)}`,
      );
    }

    return await this.publishContainer(accountId, accessToken, carouselData.id);
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
        code: 'INSTAGRAM_ERROR',
        message: message.substring(0, 500),
        retryable,
      };
    }

    return {
      code: 'INSTAGRAM_UNKNOWN_ERROR',
      message: String(error).substring(0, 500),
      retryable: false,
    };
  }

  supportsFeature(feature: string): boolean {
    const supported = ['images', 'video', 'carousel'];
    return supported.includes(feature);
  }

  // --- Private helpers ---

  private async createMediaContainer(
    accountId: string,
    accessToken: string,
    asset: MediaAsset,
    storagePath: string,
    caption?: string,
    locationId?: string,
    isCarouselItem?: boolean,
  ): Promise<string> {
    const isVideo = asset.type === 'video';
    const params = new URLSearchParams({ access_token: accessToken });

    if (isVideo) {
      params.set('media_type', 'VIDEO');
      params.set('video_url', storagePath);
    } else {
      params.set('image_url', storagePath);
    }

    if (isCarouselItem) {
      params.set('is_carousel_item', 'true');
    } else {
      if (caption) params.set('caption', caption);
      if (locationId) params.set('location_id', locationId);
    }

    const res = await fetch(
      `${INSTAGRAM_GRAPH_API_BASE}/${accountId}/media?${params}`,
      { method: 'POST' },
    );
    const data = await res.json() as { id?: string } & GraphApiError;
    if (!data.id) {
      throw new Error(
        `Failed to create media container: ${data.error?.message || JSON.stringify(data)}`,
      );
    }
    return data.id;
  }

  private async waitForMediaReady(
    containerId: string,
    accessToken: string,
    maxWaitMs: number = 60_000,
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const res = await fetch(
        `${INSTAGRAM_GRAPH_API_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`,
      );
      const data = await res.json() as { status_code?: string } & GraphApiError;
      if (data.status_code === 'FINISHED') return;
      if (data.status_code === 'ERROR') {
        throw new Error('Instagram media processing failed');
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error('Timed out waiting for Instagram media processing');
  }

  private async publishContainer(
    accountId: string,
    accessToken: string,
    containerId: string,
  ): Promise<PublishResult> {
    const params = new URLSearchParams({
      creation_id: containerId,
      access_token: accessToken,
    });
    const res = await fetch(
      `${INSTAGRAM_GRAPH_API_BASE}/${accountId}/media_publish?${params}`,
      { method: 'POST' },
    );
    const data = await res.json() as { id?: string } & GraphApiError;
    if (!data.id) {
      throw new Error(
        `Failed to publish post: ${data.error?.message || JSON.stringify(data)}`,
      );
    }
    return { remotePostId: data.id };
  }
}
