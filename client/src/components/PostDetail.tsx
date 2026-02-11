import React from 'react';
import { format, parseISO } from 'date-fns';
import { useDeletePost } from '../hooks';
import { getMediaUrl } from '../api';
import type { Post } from '../api';

interface PostDetailProps {
  post: Post;
  onClose: () => void;
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PostDetail({ post, onClose }: PostDetailProps) {
  const deletePost = useDeletePost();

  const handleDelete = async () => {
    if (!confirm('Delete this post?')) return;
    await deletePost.mutateAsync(post.id);
    onClose();
  };

  return (
    <div className="post-detail">
      <div className="post-detail-header">
        <h2>Post Details</h2>
        <button className="btn btn-ghost" onClick={onClose}>&times;</button>
      </div>

      <div className="post-detail-body">
        <div className="detail-row">
          <span className="detail-label">Status</span>
          <span className={`badge badge-status badge-${post.status}`}>
            {statusLabel(post.status)}
          </span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Scheduled</span>
          <span>{format(parseISO(post.scheduled_at_utc), 'PPpp')}</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Content</span>
          <p className="post-content">{post.base_content}</p>
        </div>

        {post.media.length > 0 && (
          <div className="detail-row">
            <span className="detail-label">Media ({post.media.length})</span>
            <div className="media-preview-grid">
              {post.media.map((m) => (
                <div key={m.id} className="media-preview-item">
                  {m.type === 'image' ? (
                    <img src={getMediaUrl(m)} alt="" className="media-preview-img" />
                  ) : (
                    <div className="media-preview-video">
                      <span className="media-preview-video-icon">&#9654;</span>
                      <span className="media-preview-filename">{m.original_filename || 'video'}</span>
                    </div>
                  )}
                  <span className="media-preview-size">
                    {(m.size_bytes / 1024).toFixed(0)} KB
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="detail-row">
          <span className="detail-label">Platform Targets</span>
          <div className="targets-list">
            {post.platform_targets.map((t) => (
              <div key={t.id} className="target-card">
                <div className="target-header">
                  <span className="badge">{t.platform}</span>
                  <span className={`badge badge-status badge-${t.publish_status}`}>
                    {statusLabel(t.publish_status)}
                  </span>
                </div>
                {t.override_content && (
                  <div className="target-override">
                    <span className="detail-label">Override</span>
                    <p>{t.override_content}</p>
                  </div>
                )}
                {t.remote_post_id && (
                  <div className="target-remote">
                    Remote ID: {t.remote_post_id}
                  </div>
                )}
                {t.failure_reason && (
                  <div className="target-error">
                    {t.failure_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="detail-row">
          <span className="detail-label">Created</span>
          <span>{format(parseISO(post.created_at), 'PPpp')}</span>
        </div>
      </div>

      <div className="post-detail-actions">
        {post.status === 'scheduled' && (
          <button
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={deletePost.isPending}
          >
            {deletePost.isPending ? 'Deleting...' : 'Delete Post'}
          </button>
        )}
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
