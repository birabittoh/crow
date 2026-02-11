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
  MASTODON_MAX_CHARS,
  MASTODON_MAX_IMAGES,
} from './mastodon-schemas';
import fs from 'fs';
import path from 'path';

interface MastodonCredentials {
  instanceUrl: string;
  accessToken: string;
}

export class MastodonService implements PlatformService {
  readonly platformName = 'mastodon';
  private credentials: MastodonCredentials | null;

  constructor(credentials: MastodonCredentials | null) {
    this.credentials = credentials;
  }

  isAvailable(): boolean {
    return this.credentials !== null;
  }

  getOptionFields(): OptionField[] {
    return [
      {
        key: 'visibility',
        label: 'Visibility',
        type: 'enum',
        enumValues: ['public', 'unlisted', 'private', 'direct'],
        description: 'Post visibility level',
      },
      {
        key: 'spoiler_text',
        label: 'Content Warning',
        type: 'string',
        description: 'Content warning text (hides post behind a warning)',
      },
      {
        key: 'sensitive',
        label: 'Mark as Sensitive',
        type: 'boolean',
        description: 'Mark media as sensitive content',
      },
    ];
  }

  getCharacterLimits(): CharacterLimits {
    return { maxChars: MASTODON_MAX_CHARS };
  }

  validatePost(content: PublishContent): PlatformValidationError[] {
    const errors: PlatformValidationError[] = [];

    if (content.text.length > MASTODON_MAX_CHARS) {
      errors.push({
        field: 'text',
        message: `Post exceeds Mastodon limit of ${MASTODON_MAX_CHARS} characters`,
      });
    }

    const images = content.media.filter((m) => m.type === 'image');
    const videos = content.media.filter((m) => m.type === 'video');

    if (content.media.length > MASTODON_MAX_IMAGES) {
      errors.push({
        field: 'media',
        message: `Mastodon allows a maximum of ${MASTODON_MAX_IMAGES} media attachments`,
      });
    }

    if (images.length > 0 && videos.length > 0) {
      errors.push({
        field: 'media',
        message: 'Cannot mix images and videos in a single Mastodon post',
      });
    }

    return errors;
  }

  async uploadMedia(asset: MediaAsset): Promise<string> {
    if (!this.credentials) throw new Error('Mastodon not configured');

    const { instanceUrl, accessToken } = this.credentials;

    const form = new FormData();
    const fileBuffer = fs.readFileSync(asset.storage_path);
    const blob = new Blob([fileBuffer], { type: asset.mime_type });
    form.append('file', blob, path.basename(asset.storage_path));

    const res = await fetch(`${instanceUrl}/api/v2/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });

    const data = (await res.json()) as { id?: string; error?: string };
    if (!data.id) {
      throw new Error(`Failed to upload media: ${data.error || JSON.stringify(data)}`);
    }

    // v2/media returns 202 for async processing — poll until ready
    if (res.status === 202) {
      await this.waitForMediaProcessing(instanceUrl, accessToken, data.id);
    }

    return data.id;
  }

  async publishPost(content: PublishContent, uploadedMediaIds: string[]): Promise<PublishResult> {
    if (!this.credentials) throw new Error('Mastodon not configured');

    const { instanceUrl, accessToken } = this.credentials;

    const payload: Record<string, unknown> = {
      status: content.text,
    };

    if (uploadedMediaIds.length > 0) {
      payload.media_ids = uploadedMediaIds;
    }

    if (content.options.visibility) {
      payload.visibility = content.options.visibility;
    }
    if (content.options.spoiler_text) {
      payload.spoiler_text = content.options.spoiler_text;
    }
    if (content.options.sensitive) {
      payload.sensitive = true;
    }

    const res = await fetch(`${instanceUrl}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as { id?: string; error?: string };
    if (!data.id) {
      throw new Error(`Failed to publish post: ${data.error || JSON.stringify(data)}`);
    }

    return { remotePostId: data.id };
  }

  mapError(error: unknown): PlatformError {
    if (error instanceof Error) {
      const message = error.message;
      const retryable =
        message.includes('429') ||
        message.includes('timeout') ||
        message.includes('ECONNRESET') ||
        message.includes('503');

      return {
        code: 'MASTODON_ERROR',
        message: message.substring(0, 500),
        retryable,
      };
    }

    return {
      code: 'MASTODON_UNKNOWN_ERROR',
      message: String(error).substring(0, 500),
      retryable: false,
    };
  }

  supportsFeature(feature: string): boolean {
    const supported = ['text', 'images', 'video', 'visibility', 'content_warning'];
    return supported.includes(feature);
  }

  private async waitForMediaProcessing(
    instanceUrl: string,
    accessToken: string,
    mediaId: string,
    maxWaitMs: number = 60_000,
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const res = await fetch(`${instanceUrl}/api/v1/media/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.status === 200) return;
      // 206 means still processing
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error('Timed out waiting for Mastodon media processing');
  }
}
