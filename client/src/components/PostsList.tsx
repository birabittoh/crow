import React from 'react';
import { format, parseISO } from 'date-fns';
import { usePosts, useDeletePost } from '../hooks';
import type { Post } from '../api';

interface PostsListProps {
  onSelectPost: (post: Post) => void;
  onClose: () => void;
}

export default function PostsList({ onSelectPost, onClose }: PostsListProps) {
  const { data: posts = [], isLoading, error } = usePosts();
  const deletePost = useDeletePost();

  const scheduledPosts = posts
    .filter((p) => p.status === 'scheduled')
    .sort((a, b) => parseISO(a.scheduled_at_utc).getTime() - parseISO(b.scheduled_at_utc).getTime());

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this scheduled post?')) {
      await deletePost.mutateAsync(id);
    }
  };

  if (isLoading) return <div className="loading">Loading posts...</div>;
  if (error) return <div className="error">Error loading posts: {(error as Error).message}</div>;

  return (
    <div className="posts-list-container">
      <div className="posts-list-header">
        <h2>Scheduled Posts</h2>
        <button className="btn btn-ghost" onClick={onClose}>&times;</button>
      </div>

      <div className="posts-list-content">
        {scheduledPosts.length === 0 ? (
          <div className="posts-list-empty">No scheduled posts found.</div>
        ) : (
          <div className="posts-grid">
            {scheduledPosts.map((post) => (
              <div
                key={post.id}
                className="post-list-item"
                onClick={() => onSelectPost(post)}
              >
                <div className="post-list-item-info">
                  <div className="post-list-item-date">
                    {format(parseISO(post.scheduled_at_utc), 'PPP p')}
                  </div>
                  <div className="post-list-item-content">
                    {post.base_content}
                  </div>
                  <div className="post-list-item-platforms">
                    {post.platform_targets.map((target) => (
                      <span key={target.id} className="badge">
                        {target.platform}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  className="btn btn-ghost delete-btn"
                  onClick={(e) => handleDelete(e, post.id)}
                  title="Delete post"
                >
                  &#128465;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .posts-list-container {
          max-width: 800px;
          margin: 0 auto;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          overflow: hidden;
        }
        .posts-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--color-border);
        }
        .posts-list-content {
          padding: 20px;
        }
        .posts-list-empty {
          text-align: center;
          color: var(--color-text-muted);
          padding: 40px 0;
        }
        .posts-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .post-list-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .post-list-item:hover {
          border-color: var(--color-primary);
        }
        .post-list-item-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .post-list-item-date {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--color-primary);
        }
        .post-list-item-content {
          font-size: 0.95rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .post-list-item-platforms {
          display: flex;
          gap: 6px;
          margin-top: 4px;
        }
        .delete-btn {
          margin-left: 16px;
          color: var(--color-text-muted);
          font-size: 1.2rem;
          padding: 4px 8px;
        }
        .delete-btn:hover {
          color: var(--color-danger);
          background: rgba(239, 68, 68, 0.1);
        }
      `}</style>
    </div>
  );
}
