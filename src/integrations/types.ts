export interface PlatformConstraints {
  characterLimit: number;
  mediaSupport: {
    images: boolean;
    videos: boolean;
    maxImages: number;
  };
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  errorMessage?: string;
  metadata?: any;
}

export interface PlatformIntegration {
  id: string;
  name: string;
  isEnabled(): boolean;
  getConstraints(): PlatformConstraints;
  publish(content: string, media?: any[]): Promise<PublishResult>;
}
