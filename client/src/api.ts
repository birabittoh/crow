export interface OptionField {
  key: string;
  label: string;
  type: 'string' | 'boolean' | 'enum';
  enumValues?: string[];
  required?: boolean;
  description?: string;
  defaultValue?: any;
}

export interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder?: string;
  required?: boolean;
}

export interface CharacterLimits {
  maxChars: number;
  maxCharsWithMedia?: number;
  requiresMedia?: boolean;
}

export interface AppConfig {
  platforms: string[];
  allPlatforms: string[];
  platformOptions: Record<string, OptionField[]>;
  platformLimits: Record<string, CharacterLimits>;
  schedulerPollIntervalMs: number;
}

export interface PlatformInfo {
  platform: string;
  configured: boolean;
  credentialFields: CredentialField[];
  currentCredentials: Record<string, string> | null;
}

export interface RecurrentEvent {
  id: number;
  day: number;
  month: number;
  name: string;
  description: string;
  year?: number;
}

export interface PlatformTarget {
  id: string;
  post_id: string;
  platform: string;
  override_content: string | null;
  override_media_json: string | null;
  override_options_json: string | null;
  publish_status: string;
  remote_post_id: string | null;
  failure_reason: string | null;
  last_attempt_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaAsset {
  id: string;
  post_id: string | null;
  type: 'image' | 'video';
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  file_hash: string | null;
  original_filename: string | null;
  created_at: string;
  usage_count?: number;
}

export interface Post {
  id: string;
  base_content: string;
  scheduled_at_utc: string;
  status: string;
  created_at: string;
  updated_at: string;
  platform_targets: PlatformTarget[];
  media: MediaAsset[];
}

export interface CreatePostPayload {
  base_content: string;
  scheduled_at_utc: string;
  platform_targets: {
    platform: string;
    override_content?: string | null;
    override_media_json?: { media_asset_id: string }[] | null;
    override_options_json?: Record<string, unknown> | null;
  }[];
  media_ids?: string[];
}

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(message: string, status: number, body: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `HTTP ${res.status}`, res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function getMediaUrl(asset: MediaAsset): string {
  // storage_path is an absolute path like /path/to/uploads/uuid.ext
  // Extract just the filename to build the URL
  const filename = asset.storage_path.split('/').pop() || asset.storage_path.split('\\').pop();
  return `/uploads/${filename}`;
}

export const api = {
  getConfig: () => apiFetch<AppConfig>('/api/config'),
  getRecurrentEvents: () => apiFetch<RecurrentEvent[]>('/api/recurrent-events'),
  getPosts: () => apiFetch<Post[]>('/api/posts'),
  getPost: (id: string) => apiFetch<Post>(`/api/posts/${id}`),
  createPost: (data: CreatePostPayload) =>
    apiFetch<Post>('/api/posts', { method: 'POST', body: JSON.stringify(data) }),
  updatePost: (id: string, data: Partial<CreatePostPayload>) =>
    apiFetch<Post>(`/api/posts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePost: (id: string) =>
    apiFetch<void>(`/api/posts/${id}`, { method: 'DELETE' }),

  // Media library
  getMedia: (filters?: { filter?: string }) => {
    const params = new URLSearchParams();
    if (filters?.filter) params.set('filter', filters.filter);
    const qs = params.toString();
    return apiFetch<MediaAsset[]>(`/api/media${qs ? `?${qs}` : ''}`);
  },
  uploadMedia: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch('/api/media/upload', { method: 'POST', body: formData }).then((r) => {
      if (!r.ok) throw new Error('Upload failed');
      return r.json() as Promise<MediaAsset>;
    });
  },
  deleteMedia: (id: string) =>
    apiFetch<void>(`/api/media/${id}`, { method: 'DELETE' }),
  bulkDeleteMedia: (ids: string[]) =>
    apiFetch<void>('/api/media/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),

  // Platform credentials
  getPlatforms: () => apiFetch<PlatformInfo[]>('/api/platforms'),
  savePlatformCredentials: (platform: string, credentials: Record<string, string>) =>
    apiFetch<{ success: boolean }>(`/api/platforms/${platform}`, {
      method: 'PUT',
      body: JSON.stringify(credentials),
    }),
  deletePlatformCredentials: (platform: string) =>
    apiFetch<{ success: boolean }>(`/api/platforms/${platform}`, { method: 'DELETE' }),
};
