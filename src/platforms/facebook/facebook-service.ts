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
  FACEBOOK_MAX_POST_LENGTH,
  FACEBOOK_MAX_IMAGES,
  FACEBOOK_GRAPH_API_BASE,
} from './facebook-schemas';
import fs from 'fs';
import path from 'path';

interface FacebookCredentials {
  pageAccessToken: string;
  pageId: string;
}

interface GraphApiError {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
  };
}

export class FacebookService implements PlatformService {
  readonly platformName = 'facebook';
  private credentials: FacebookCredentials | null;

  constructor(credentials: FacebookCredentials | null) {
    this.credentials = credentials;
  }

  getCredentialFields(): CredentialField[] {
    return [
      { key: 'pageAccessToken', label: 'Page Access Token', type: 'password', placeholder: 'Facebook Page access token' },
      { key: 'pageId', label: 'Page ID', type: 'text', placeholder: 'Facebook Page ID' },
    ];
  }

  isAvailable(): boolean {
    return this.credentials !== null;
  }

  getOptionFields(): OptionField[] {
    return [
      {
        key: 'link',
        label: 'Link URL',
        type: 'string',
        description: 'URL to attach as a link post',
      },
    ];
  }

  getCharacterLimits(): CharacterLimits {
    return {
      maxChars: FACEBOOK_MAX_POST_LENGTH,
    };
  }

  validatePost(content: PublishContent): PlatformValidationError[] {
    const errors: PlatformValidationError[] = [];

    if (content.text.length > FACEBOOK_MAX_POST_LENGTH) {
      errors.push({
        field: 'text',
        message: `Post exceeds Facebook limit of ${FACEBOOK_MAX_POST_LENGTH} characters`,
      });
    }

    const images = content.media.filter((m) => m.type === 'image');
    if (images.length > FACEBOOK_MAX_IMAGES) {
      errors.push({
        field: 'media',
        message: `Facebook allows a maximum of ${FACEBOOK_MAX_IMAGES} images per post`,
      });
    }

    return errors;
  }

  async uploadMedia(asset: MediaAsset): Promise<string> {
    if (!this.credentials) throw new Error('Facebook not configured');

    const { pageAccessToken, pageId } = this.credentials;

    if (asset.type === 'image') {
      // Upload photo as unpublished to get an ID for multi-photo posts
      const form = new FormData();
      const fileBuffer = fs.readFileSync(asset.storage_path);
      const blob = new Blob([fileBuffer], { type: asset.mime_type });
      form.append('source', blob, path.basename(asset.storage_path));
      form.append('published', 'false');
      form.append('access_token', pageAccessToken);

      const res = await fetch(`${FACEBOOK_GRAPH_API_BASE}/${pageId}/photos`, {
        method: 'POST',
        body: form,
      });
      const data = (await res.json()) as { id?: string } & GraphApiError;
      if (!data.id) {
        throw new Error(
          `Failed to upload photo: ${data.error?.message || JSON.stringify(data)}`,
        );
      }
      return data.id;
    }

    // Video upload
    const form = new FormData();
    const fileBuffer = fs.readFileSync(asset.storage_path);
    const blob = new Blob([fileBuffer], { type: asset.mime_type });
    form.append('source', blob, path.basename(asset.storage_path));
    form.append('published', 'false');
    form.append('access_token', pageAccessToken);

    const res = await fetch(`${FACEBOOK_GRAPH_API_BASE}/${pageId}/videos`, {
      method: 'POST',
      body: form,
    });
    const data = (await res.json()) as { id?: string } & GraphApiError;
    if (!data.id) {
      throw new Error(
        `Failed to upload video: ${data.error?.message || JSON.stringify(data)}`,
      );
    }
    return data.id;
  }

  async publishPost(content: PublishContent, uploadedMediaIds: string[]): Promise<PublishResult> {
    if (!this.credentials) throw new Error('Facebook not configured');

    const { pageAccessToken, pageId } = this.credentials;
    const linkUrl = content.options.link as string | undefined;

    // Text-only or link post (no media)
    if (uploadedMediaIds.length === 0) {
      const params = new URLSearchParams({
        access_token: pageAccessToken,
      });
      if (content.text) params.set('message', content.text);
      if (linkUrl) params.set('link', linkUrl);

      const res = await fetch(`${FACEBOOK_GRAPH_API_BASE}/${pageId}/feed?${params}`, {
        method: 'POST',
      });
      const data = (await res.json()) as { id?: string } & GraphApiError;
      if (!data.id) {
        throw new Error(
          `Failed to publish post: ${data.error?.message || JSON.stringify(data)}`,
        );
      }
      return { remotePostId: data.id };
    }

    // Single video post
    const videos = content.media.filter((m) => m.type === 'video');
    if (videos.length > 0) {
      // Video was uploaded as unpublished, now publish it
      const videoId = uploadedMediaIds.find((_, i) => content.media[i].type === 'video')!;
      const params = new URLSearchParams({
        access_token: pageAccessToken,
        published: 'true',
      });
      if (content.text) params.set('description', content.text);

      const res = await fetch(`${FACEBOOK_GRAPH_API_BASE}/${videoId}?${params}`, {
        method: 'POST',
      });
      const data = (await res.json()) as { success?: boolean; id?: string } & GraphApiError;
      if (data.error) {
        throw new Error(
          `Failed to publish video: ${data.error.message || JSON.stringify(data)}`,
        );
      }
      return { remotePostId: videoId };
    }

    // Photo post(s) — attach uploaded photo IDs to a feed post
    const params = new URLSearchParams({
      access_token: pageAccessToken,
    });
    if (content.text) params.set('message', content.text);

    // Attach each photo as attached_media[i]
    const attachedMedia: Record<string, string> = {};
    uploadedMediaIds.forEach((id, i) => {
      params.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id }));
    });

    const res = await fetch(`${FACEBOOK_GRAPH_API_BASE}/${pageId}/feed?${params}`, {
      method: 'POST',
    });
    const data = (await res.json()) as { id?: string } & GraphApiError;
    if (!data.id) {
      throw new Error(
        `Failed to publish post: ${data.error?.message || JSON.stringify(data)}`,
      );
    }
    return { remotePostId: data.id };
  }

  async verifyCredentials(): Promise<void> {
    if (!this.credentials) throw new Error('Facebook not configured');
    const { pageAccessToken, pageId } = this.credentials;

    const res = await fetch(`${FACEBOOK_GRAPH_API_BASE}/${pageId}?access_token=${pageAccessToken}`);
    const data = (await res.json()) as { id?: string } & GraphApiError;

    if (!data.id) {
      throw new Error(`Facebook validation failed: ${data.error?.message || 'Invalid Page ID or Access Token'}`);
    }
  }

  mapError(error: unknown): PlatformError {
    if (error instanceof Error) {
      const message = error.message;
      const retryable =
        message.includes('"code":4') ||
        message.includes('"code":32') ||
        message.includes('timeout') ||
        message.includes('ECONNRESET') ||
        message.includes('503');

      return {
        code: 'FACEBOOK_ERROR',
        message: message.substring(0, 500),
        retryable,
      };
    }

    return {
      code: 'FACEBOOK_UNKNOWN_ERROR',
      message: String(error).substring(0, 500),
      retryable: false,
    };
  }

  supportsFeature(feature: string): boolean {
    const supported = ['text', 'images', 'video', 'link'];
    return supported.includes(feature);
  }
}
