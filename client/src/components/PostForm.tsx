import React, { useState } from 'react';
import { format } from 'date-fns';
import { useCreatePost } from '../hooks';

interface PostFormProps {
  platforms: string[];
  initialDate: Date | null;
  onClose: () => void;
}

export default function PostForm({ platforms, initialDate, onClose }: PostFormProps) {
  const createPost = useCreatePost();

  const defaultDateTime = initialDate
    ? format(initialDate, "yyyy-MM-dd'T'HH:mm")
    : format(new Date(), "yyyy-MM-dd'T'HH:mm");

  const [content, setContent] = useState('');
  const [scheduledAt, setScheduledAt] = useState(defaultDateTime);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(platforms);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!content.trim()) {
      setError('Content is required');
      return;
    }
    if (selectedPlatforms.length === 0) {
      setError('Select at least one platform');
      return;
    }

    try {
      await createPost.mutateAsync({
        base_content: content,
        scheduled_at_utc: new Date(scheduledAt).toISOString(),
        platform_targets: selectedPlatforms.map((p) => ({
          platform: p,
          override_content: overrides[p] || null,
        })),
      });
      onClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="post-form-container">
      <div className="post-form-header">
        <h2>Schedule Post</h2>
        <button className="btn btn-ghost" onClick={onClose}>&times;</button>
      </div>

      <form onSubmit={handleSubmit} className="post-form">
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <label>Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="What do you want to post?"
            className="form-textarea"
          />
          <span className="char-count">{content.length} characters</span>
        </div>

        <div className="form-group">
          <label>Schedule Date & Time (UTC)</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Platforms</label>
          <div className="platform-selector">
            {platforms.map((p) => (
              <label key={p} className="platform-checkbox">
                <input
                  type="checkbox"
                  checked={selectedPlatforms.includes(p)}
                  onChange={() => togglePlatform(p)}
                />
                <span className="badge">{p}</span>
              </label>
            ))}
          </div>
        </div>

        {selectedPlatforms.map((p) => (
          <div key={p} className="form-group override-group">
            <label>Override for {p} (optional)</label>
            <textarea
              value={overrides[p] || ''}
              onChange={(e) =>
                setOverrides((prev) => ({ ...prev, [p]: e.target.value }))
              }
              rows={2}
              placeholder={`Custom content for ${p}...`}
              className="form-textarea form-textarea-small"
            />
          </div>
        ))}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createPost.isPending}
          >
            {createPost.isPending ? 'Scheduling...' : 'Schedule Post'}
          </button>
        </div>
      </form>
    </div>
  );
}
