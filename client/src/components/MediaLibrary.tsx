import React, { useState, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { useMedia, useUploadMedia, useDeleteMedia, useBulkDeleteMedia } from '../hooks';
import { getMediaUrl, ApiError } from '../api';
import type { MediaAsset } from '../api';

type FilterMode = 'all' | 'scheduled' | 'posted' | 'unused';

interface ScheduledPostRef {
  id: string;
  base_content: string;
  scheduled_at_utc: string;
  status: string;
}

interface BlockedInfo {
  scheduledPosts: ScheduledPostRef[];
}

export default function MediaLibrary({ onClose, onNavigateToPost }: { onClose: () => void; onNavigateToPost?: (postId: string) => void }) {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [blockedInfo, setBlockedInfo] = useState<BlockedInfo | null>(null);

  const filterParam = filter === 'all' ? undefined : { filter };
  const { data: media = [], isLoading } = useMedia(filterParam);
  const uploadMedia = useUploadMedia();
  const deleteMedia = useDeleteMedia();
  const bulkDelete = useBulkDeleteMedia();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === media.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(media.map((m) => m.id)));
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    for (let i = 0; i < e.target.files.length; i++) {
      await uploadMedia.mutateAsync(e.target.files[i]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await bulkDelete.mutateAsync(Array.from(selectedIds));
      setSelectedIds(new Set());
      setConfirmDelete(false);
      setBlockedInfo(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Collect all unique scheduled posts from blocked items
        const posts: ScheduledPostRef[] = [];
        const seenIds = new Set<string>();
        for (const b of err.body.blocked || []) {
          for (const p of b.posts || []) {
            if (!seenIds.has(p.id)) {
              seenIds.add(p.id);
              posts.push(p);
            }
          }
        }
        setBlockedInfo({ scheduledPosts: posts });
      }
    }
  };

  return (
    <div className="media-library">
      <div className="media-library-header">
        <h2>Media Library</h2>
        <button className="btn btn-ghost" onClick={onClose}>&times;</button>
      </div>

      <div className="media-library-toolbar">
        <div className="media-library-filters">
          {(['all', 'scheduled', 'posted', 'unused'] as FilterMode[]).map((f) => (
            <button
              key={f}
              className={`btn btn-ghost filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => { setFilter(f); setSelectedIds(new Set()); }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="media-library-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4"
            multiple
            onChange={handleUpload}
            className="media-file-input"
            id="library-upload"
          />
          <label htmlFor="library-upload" className="btn btn-primary">
            {uploadMedia.isPending ? 'Uploading...' : '+ Upload'}
          </label>
          {media.length > 0 && (
            <button className="btn btn-ghost" onClick={selectAll}>
              {selectedIds.size === media.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              className="btn btn-danger"
              onClick={() => { setBlockedInfo(null); setConfirmDelete(true); }}
            >
              Delete ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {isLoading && <div className="loading">Loading media...</div>}

      {!isLoading && media.length === 0 && (
        <div className="media-library-empty">
          No media files{filter !== 'all' ? ` (${filter})` : ''}. Upload some to get started.
        </div>
      )}

      <div className="media-library-grid">
        {media.map((asset) => (
          <div
            key={asset.id}
            className={`media-library-item ${selectedIds.has(asset.id) ? 'selected' : ''}`}
            onClick={() => toggleSelect(asset.id)}
          >
            <div className="media-library-thumb-container">
              {asset.type === 'image' ? (
                <img src={getMediaUrl(asset)} alt="" className="media-library-thumb" />
              ) : (
                <div className="media-library-video-thumb">
                  <span className="media-preview-video-icon">&#9654;</span>
                </div>
              )}
              <input
                type="checkbox"
                className="media-library-checkbox"
                checked={selectedIds.has(asset.id)}
                onChange={() => toggleSelect(asset.id)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="media-library-info">
              <span className="media-library-name" title={asset.original_filename || asset.id}>
                {asset.original_filename || asset.id.slice(0, 12)}
              </span>
              <span className="media-library-meta">
                {(asset.size_bytes / 1024).toFixed(0)} KB
                {asset.usage_count !== undefined && (
                  <> &middot; {asset.usage_count} {asset.usage_count === 1 ? 'post' : 'posts'}</>
                )}
              </span>
              <span className="media-library-date">
                {format(parseISO(asset.created_at), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => { setConfirmDelete(false); setBlockedInfo(null); }}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete {selectedIds.size} file{selectedIds.size !== 1 ? 's' : ''}?</h3>

            {blockedInfo ? (
              <div className="blocked-delete-info">
                <p>Cannot delete — the following scheduled posts use the selected media:</p>
                <ul className="blocked-post-list">
                  {blockedInfo.scheduledPosts.map((post) => (
                    <li key={post.id}>
                      <button
                        type="button"
                        className="blocked-post-link"
                        onClick={() => {
                          setConfirmDelete(false);
                          setBlockedInfo(null);
                          onNavigateToPost?.(post.id);
                        }}
                      >
                        <span className="blocked-post-content">
                          {post.base_content.length > 60
                            ? post.base_content.slice(0, 60) + '...'
                            : post.base_content}
                        </span>
                        <span className="blocked-post-date">
                          {format(parseISO(post.scheduled_at_utc), 'MMM d, yyyy HH:mm')}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p>This will permanently delete the selected files and remove them from any posts they're attached to.</p>
            )}

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setConfirmDelete(false); setBlockedInfo(null); }}>
                {blockedInfo ? 'Close' : 'Cancel'}
              </button>
              {!blockedInfo && (
                <button
                  className="btn btn-danger"
                  onClick={handleBulkDelete}
                  disabled={bulkDelete.isPending}
                >
                  {bulkDelete.isPending ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
