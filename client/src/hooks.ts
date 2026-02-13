import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type CreatePostPayload } from './api';

export function useFileDrop(onDrop: (files: FileList) => void) {
  const [isDragging, setIsDragging] = useState(false);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onDropHandler = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDrop(e.dataTransfer.files);
    }
  };

  return { isDragging, onDragOver, onDragLeave, onDrop: onDropHandler };
}

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
    staleTime: Infinity,
  });
}

export function useRecurrentEvents() {
  return useQuery({
    queryKey: ['recurrent-events'],
    queryFn: api.getRecurrentEvents,
    staleTime: Infinity,
  });
}

export function usePosts() {
  return useQuery({
    queryKey: ['posts'],
    queryFn: api.getPosts,
    refetchInterval: 30_000,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePostPayload) => api.createPost(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

export function useUpdatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePostPayload> }) =>
      api.updatePost(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

export function useMedia(filters?: { filter?: string }) {
  return useQuery({
    queryKey: ['media', filters],
    queryFn: () => api.getMedia(filters),
  });
}

export function useUploadMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadMedia(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
    },
  });
}

export function useDeleteMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteMedia(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
    },
  });
}

export function useBulkDeleteMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.bulkDeleteMedia(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
    },
  });
}

// Platform credentials
export function usePlatforms() {
  return useQuery({
    queryKey: ['platforms'],
    queryFn: api.getPlatforms,
  });
}

export function useSavePlatformCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ platform, credentials }: { platform: string; credentials: Record<string, string> }) =>
      api.savePlatformCredentials(platform, credentials),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platforms'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
  });
}

export function useDeletePlatformCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (platform: string) => api.deletePlatformCredentials(platform),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platforms'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
  });
}
