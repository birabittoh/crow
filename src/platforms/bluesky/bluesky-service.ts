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
  BLUESKY_MAX_CHARS,
  BLUESKY_MAX_IMAGES,
} from './bluesky-schemas';
import fs from 'fs';

interface BlueskyCredentials {
  service: string;
  identifier: string;
  password: string;
}

interface BlueskySession {
  accessJwt: string;
  did: string;
}

interface BlobRef {
  $type: 'blob';
  ref: { $link: string };
  mimeType: string;
  size: number;
}

export class BlueskyService implements PlatformService {
  readonly platformName = 'bluesky';
  private credentials: BlueskyCredentials | null;
  private session: BlueskySession | null = null;

  constructor(credentials: BlueskyCredentials | null) {
    this.credentials = credentials;
  }

  getCredentialFields(): CredentialField[] {
    return [
      { key: 'service', label: 'Service URL', type: 'text', placeholder: 'https://bsky.social' },
      { key: 'identifier', label: 'Handle or Email', type: 'text', placeholder: 'user.bsky.social or email' },
      { key: 'password', label: 'App Password', type: 'password', placeholder: 'App password (not main password)' },
    ];
  }

  isAvailable(): boolean {
    return this.credentials !== null;
  }

  getOptionFields(): OptionField[] {
    return [
      {
        key: 'langs',
        label: 'Language',
        type: 'string',
        description: 'Language code(s), comma-separated (e.g. "en", "en,fr")',
      },
    ];
  }

  getCharacterLimits(): CharacterLimits {
    return { maxChars: BLUESKY_MAX_CHARS };
  }

  validatePost(content: PublishContent): PlatformValidationError[] {
    const errors: PlatformValidationError[] = [];

    if (content.text.length > BLUESKY_MAX_CHARS) {
      errors.push({
        field: 'text',
        message: `Post exceeds Bluesky limit of ${BLUESKY_MAX_CHARS} characters`,
      });
    }

    const images = content.media.filter((m) => m.type === 'image');
    const videos = content.media.filter((m) => m.type === 'video');

    if (images.length > BLUESKY_MAX_IMAGES) {
      errors.push({
        field: 'media',
        message: `Bluesky allows a maximum of ${BLUESKY_MAX_IMAGES} images per post`,
      });
    }

    if (videos.length > 0) {
      errors.push({
        field: 'media',
        message: 'Bluesky does not support video uploads via the API',
      });
    }

    return errors;
  }

  async uploadMedia(asset: MediaAsset): Promise<string> {
    if (!this.credentials) throw new Error('Bluesky not configured');

    const session = await this.ensureSession();
    const fileBuffer = fs.readFileSync(asset.storage_path);

    const res = await fetch(`${this.credentials.service}/xrpc/com.atproto.repo.uploadBlob`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessJwt}`,
        'Content-Type': asset.mime_type,
      },
      body: fileBuffer,
    });

    const data = (await res.json()) as { blob?: BlobRef; error?: string; message?: string };
    if (!data.blob) {
      throw new Error(`Failed to upload blob: ${data.message || data.error || JSON.stringify(data)}`);
    }

    // Return the blob reference as JSON string so publishPost can parse it
    return JSON.stringify(data.blob);
  }

  async publishPost(content: PublishContent, uploadedMediaIds: string[]): Promise<PublishResult> {
    if (!this.credentials) throw new Error('Bluesky not configured');

    const session = await this.ensureSession();
    const now = new Date().toISOString();

    const record: Record<string, unknown> = {
      $type: 'app.bsky.feed.post',
      text: content.text,
      createdAt: now,
    };

    // Parse facets (links, mentions) from text
    const facets = this.detectFacets(content.text);
    if (facets.length > 0) {
      record.facets = facets;
    }

    // Attach images as embed
    if (uploadedMediaIds.length > 0) {
      const images = uploadedMediaIds.map((blobJson, i) => {
        const blob = JSON.parse(blobJson);
        return {
          alt: '',
          image: blob,
        };
      });

      record.embed = {
        $type: 'app.bsky.embed.images',
        images,
      };
    }

    // Language tags
    const langs = content.options.langs as string | undefined;
    if (langs) {
      record.langs = langs.split(',').map((l) => l.trim());
    }

    const res = await fetch(`${this.credentials.service}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repo: session.did,
        collection: 'app.bsky.feed.post',
        record,
      }),
    });

    const data = (await res.json()) as { uri?: string; cid?: string; error?: string; message?: string };
    if (!data.uri) {
      throw new Error(`Failed to create post: ${data.message || data.error || JSON.stringify(data)}`);
    }

    return { remotePostId: data.uri };
  }

  mapError(error: unknown): PlatformError {
    if (error instanceof Error) {
      const message = error.message;
      const retryable =
        message.includes('RateLimit') ||
        message.includes('timeout') ||
        message.includes('ECONNRESET') ||
        message.includes('502') ||
        message.includes('503');

      return {
        code: 'BLUESKY_ERROR',
        message: message.substring(0, 500),
        retryable,
      };
    }

    return {
      code: 'BLUESKY_UNKNOWN_ERROR',
      message: String(error).substring(0, 500),
      retryable: false,
    };
  }

  supportsFeature(feature: string): boolean {
    const supported = ['text', 'images'];
    return supported.includes(feature);
  }

  private async ensureSession(): Promise<BlueskySession> {
    if (this.session) return this.session;
    if (!this.credentials) throw new Error('Bluesky not configured');

    const res = await fetch(`${this.credentials.service}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: this.credentials.identifier,
        password: this.credentials.password,
      }),
    });

    const data = (await res.json()) as { accessJwt?: string; did?: string; error?: string; message?: string };
    if (!data.accessJwt || !data.did) {
      throw new Error(`Bluesky auth failed: ${data.message || data.error || JSON.stringify(data)}`);
    }

    this.session = { accessJwt: data.accessJwt, did: data.did };
    return this.session;
  }

  private detectFacets(text: string): unknown[] {
    const facets: unknown[] = [];

    // Detect URLs
    const urlRegex = /https?:\/\/[^\s)]+/g;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
      const byteStart = Buffer.byteLength(text.slice(0, match.index), 'utf8');
      const byteEnd = byteStart + Buffer.byteLength(match[0], 'utf8');
      facets.push({
        index: { byteStart, byteEnd },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: match[0] }],
      });
    }

    // Detect mentions (@handle.bsky.social)
    const mentionRegex = /@([a-zA-Z0-9._-]+\.[a-zA-Z]+)/g;
    while ((match = mentionRegex.exec(text)) !== null) {
      const byteStart = Buffer.byteLength(text.slice(0, match.index), 'utf8');
      const byteEnd = byteStart + Buffer.byteLength(match[0], 'utf8');
      facets.push({
        index: { byteStart, byteEnd },
        features: [{ $type: 'app.bsky.richtext.facet#mention', did: match[1] }],
      });
    }

    return facets;
  }
}
