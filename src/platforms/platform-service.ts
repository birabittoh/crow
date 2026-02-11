import { MediaAsset } from '../schemas/media';

export interface PublishContent {
  text: string;
  media: MediaAsset[];
  options: Record<string, unknown>;
}

export interface PublishResult {
  remotePostId: string;
}

export interface PlatformValidationError {
  field: string;
  message: string;
}

export interface PlatformError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface PlatformService {
  readonly platformName: string;

  /** Check if the platform has valid credentials and is available */
  isAvailable(): boolean;

  /** Validate post content against platform constraints before scheduling */
  validatePost(content: PublishContent): PlatformValidationError[];

  /** Upload a media asset to the platform, returns platform-specific media ID */
  uploadMedia(asset: MediaAsset): Promise<string>;

  /** Publish a post to the platform */
  publishPost(content: PublishContent, uploadedMediaIds: string[]): Promise<PublishResult>;

  /** Map a platform-specific error to a standardized error */
  mapError(error: unknown): PlatformError;

  /** Check if the platform supports a specific feature */
  supportsFeature(feature: string): boolean;
}
