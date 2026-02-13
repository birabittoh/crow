import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { usePosts, useDeletePost } from '../hooks';
import ConfirmModal from '../components/ConfirmModal';
import type { Post } from '../api';

interface PostsListProps {
  onSelectPost: (post: Post) => void;
  onClose: () => void;
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PostsPage({ onSelectPost, onClose }: PostsListProps) {
  const { data: posts = [], isLoading, error } = usePosts();
  const deletePost = useDeletePost();
  const [postToDelete, setPostToDelete] = useState<string | null>(null);

  const sortedPosts = [...posts].sort((a, b) => {
    if (a.status === 'scheduled' && b.status !== 'scheduled') return -1;
    if (a.status !== 'scheduled' && b.status === 'scheduled') return 1;

    const timeA = parseISO(a.scheduled_at_utc).getTime();
    const timeB = parseISO(b.scheduled_at_utc).getTime();

    if (a.status === 'scheduled') {
      return timeA - timeB; // Ascending for future
    } else {
      return timeB - timeA; // Descending for past
    }
  });

  const handleDelete = async () => {
    if (postToDelete) {
      await deletePost.mutateAsync(postToDelete);
      setPostToDelete(null);
    }
  };

  if (isLoading) return <div className="loading">Loading posts...</div>;
  if (error) return <div className="error">Error loading posts: {(error as Error).message}</div>;

  return (
    <div className="posts-list-container">
      <div className="posts-list-header">
        <h2>Posts</h2>
        <button className="btn btn-ghost" onClick={onClose}>&times;</button>
      </div>

      <div className="posts-list-content">
        {sortedPosts.length === 0 ? (
          <div className="posts-list-empty">No posts found.</div>
        ) : (
          <div className="posts-grid">
            {sortedPosts.map((post) => (
              <div
                key={post.id}
                className={`post-list-item ${post.status !== 'scheduled' ? 'past-post' : ''}`}
                onClick={() => onSelectPost(post)}
              >
                <div className="post-list-item-info">
                  <div className="post-list-item-header">
                    <div className="post-list-item-date">
                      {format(parseISO(post.scheduled_at_utc), 'PPP p')}
                    </div>
                    <span className={`badge badge-status badge-${post.status} badge-small`}>
                      {statusLabel(post.status)}
                    </span>
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
                {post.status === 'scheduled' && (
                  <button
                    className="btn btn-ghost delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPostToDelete(post.id);
                    }}
                    title="Delete post"
                  >
                    &#128465;
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {postToDelete && (
        <ConfirmModal
          title="Delete Post"
          message="Are you sure you want to delete this post?"
          confirmLabel="Delete"
          isDanger
          onConfirm={handleDelete}
          onCancel={() => setPostToDelete(null)}
        />
      )}
    </div>
  );
}
