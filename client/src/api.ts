export interface OptionField {
  key: string;
  label: string;
  type: 'string' | 'boolean' | 'enum';
  enumValues?: string[];
  required?: boolean;
  description?: string;
}

export interface AppConfig {
  platforms: string[];
  platformOptions: Record<string, OptionField[]>;
  schedulerPollIntervalMs: number;
  recurrentEventsUrl: string | null;
}

export interface RecurrentEvent {
  id: number;
  day: number;
  month: number;
  name: string;
  description: string;
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
  post_id: string;
  type: 'image' | 'video';
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  created_at: string;
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
    override_options_json?: Record<string, unknown> | null;
  }[];
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
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getConfig: () => apiFetch<AppConfig>('/api/config'),
  getRecurrentEvents: (url: string) =>
    fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch recurrent events: ${r.status}`);
      return r.json() as Promise<RecurrentEvent[]>;
    }),
  getPosts: () => apiFetch<Post[]>('/api/posts'),
  getPost: (id: string) => apiFetch<Post>(`/api/posts/${id}`),
  createPost: (data: CreatePostPayload) =>
    apiFetch<Post>('/api/posts', { method: 'POST', body: JSON.stringify(data) }),
  updatePost: (id: string, data: Partial<CreatePostPayload>) =>
    apiFetch<Post>(`/api/posts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePost: (id: string) =>
    apiFetch<void>(`/api/posts/${id}`, { method: 'DELETE' }),
  uploadMedia: (postId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('post_id', postId);
    return fetch('/api/media/upload', { method: 'POST', body: formData }).then((r) => {
      if (!r.ok) throw new Error('Upload failed');
      return r.json() as Promise<MediaAsset>;
    });
  },
};
