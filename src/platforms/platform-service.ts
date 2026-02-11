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

export interface OptionField {
  /** Machine-readable key, e.g. "parse_mode" */
  key: string;
  /** Human-readable label, e.g. "Parse Mode" */
  label: string;
  /** Field type determines how the frontend renders it */
  type: 'string' | 'boolean' | 'enum';
  /** Available choices when type is "enum" */
  enumValues?: string[];
  /** Whether this field is required */
  required?: boolean;
  /** Short description shown as helper text */
  description?: string;
}

export interface PlatformService {
  readonly platformName: string;

  /** Check if the platform has valid credentials and is available */
  isAvailable(): boolean;

  /** Describe the platform-specific options this platform supports */
  getOptionFields(): OptionField[];

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
