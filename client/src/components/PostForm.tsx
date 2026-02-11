import React, { useState, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { useCreatePost } from '../hooks';
import { api } from '../api';
import type { OptionField, CharacterLimits } from '../api';

interface PostFormProps {
  platforms: string[];
  platformOptions: Record<string, OptionField[]>;
  platformLimits: Record<string, CharacterLimits>;
  initialDate: Date | null;
  onClose: () => void;
}

interface PlatformValidationError {
  platform: string;
  message: string;
}

function validateContentLimits(
  content: string,
  selectedPlatforms: string[],
  overrides: Record<string, string>,
  platformLimits: Record<string, CharacterLimits>,
  hasMedia: boolean,
): PlatformValidationError[] {
  const errors: PlatformValidationError[] = [];
  for (const platform of selectedPlatforms) {
    const limits = platformLimits[platform];
    if (!limits) continue;
    const text = overrides[platform] || content;
    const maxChars = hasMedia && limits.maxCharsWithMedia != null
      ? limits.maxCharsWithMedia
      : limits.maxChars;
    if (text.length > maxChars) {
      errors.push({
        platform,
        message: `${text.length}/${maxChars} characters`,
      });
    }
  }
  return errors;
}

interface SelectedFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

export default function PostForm({ platforms, platformOptions, platformLimits, initialDate, onClose }: PostFormProps) {
  const createPost = useCreatePost();

  const defaultDateTime = initialDate
    ? format(initialDate, "yyyy-MM-dd'T'HH:mm")
    : format(new Date(), "yyyy-MM-dd'T'HH:mm");

  const [content, setContent] = useState('');
  const [scheduledAt, setScheduledAt] = useState(defaultDateTime);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(platforms);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, Record<string, unknown>>>({});
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [activeTab, setActiveTab] = useState(platforms[0] || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const setOptionValue = (platform: string, key: string, value: unknown) => {
    setOptions((prev) => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [key]: value,
      },
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;

    const newFiles: SelectedFile[] = [];
    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) continue;

      newFiles.push({
        file,
        preview: isImage ? URL.createObjectURL(file) : '',
        type: isImage ? 'image' : 'video',
      });
    }

    setFiles((prev) => [...prev, ...newFiles]);
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const removed = prev[index];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const contentErrors = useMemo(
    () => validateContentLimits(content, selectedPlatforms, overrides, platformLimits, files.length > 0),
    [content, selectedPlatforms, overrides, platformLimits, files.length],
  );

  const PLATFORMS_REQUIRING_MEDIA = ['instagram'];
  const mediaRequiredPlatforms = selectedPlatforms.filter(
    (p) => PLATFORMS_REQUIRING_MEDIA.includes(p) && files.length === 0
  );

  const hasContentErrors = contentErrors.length > 0 || mediaRequiredPlatforms.length > 0;

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

    setSubmitting(true);

    try {
      const post = await createPost.mutateAsync({
        base_content: content,
        scheduled_at_utc: new Date(scheduledAt).toISOString(),
        platform_targets: selectedPlatforms.map((p) => {
          const platformOpts = options[p];
          const cleanedOpts = platformOpts
            ? Object.fromEntries(
                Object.entries(platformOpts).filter(
                  ([, v]) => v !== undefined && v !== '' && v !== null
                )
              )
            : null;

          return {
            platform: p,
            override_content: overrides[p] || null,
            override_options_json:
              cleanedOpts && Object.keys(cleanedOpts).length > 0 ? cleanedOpts : null,
          };
        }),
      });

      // Upload media files
      for (const f of files) {
        await api.uploadMedia(post.id, f.file);
      }

      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
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
          <span className={`char-count ${hasContentErrors ? 'char-count-error' : ''}`}>{content.length} characters</span>
          {contentErrors.length > 0 && (
            <div className="content-limit-errors">
              {contentErrors.map((err) => (
                <span key={err.platform} className="content-limit-error">
                  {err.platform}: {err.message}
                </span>
              ))}
            </div>
          )}
          {mediaRequiredPlatforms.length > 0 && (
            <div className="content-limit-errors">
              {mediaRequiredPlatforms.map((p) => (
                <span key={p} className="content-limit-error">
                  {p}: requires at least one image or video
                </span>
              ))}
            </div>
          )}
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

        {/* Media upload */}
        <div className="form-group">
          <label>Media</label>
          <div className="media-upload-area">
            {files.length > 0 && (
              <div className="media-preview-grid">
                {files.map((f, i) => (
                  <div key={i} className="media-preview-item">
                    {f.type === 'image' ? (
                      <img src={f.preview} alt="" className="media-preview-img" />
                    ) : (
                      <div className="media-preview-video">
                        <span className="media-preview-video-icon">&#9654;</span>
                        <span className="media-preview-filename">{f.file.name}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      className="media-remove-btn"
                      onClick={() => removeFile(i)}
                    >
                      &times;
                    </button>
                    <span className="media-preview-size">
                      {(f.file.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4"
              multiple
              onChange={handleFileSelect}
              className="media-file-input"
              id="media-upload"
            />
            <label htmlFor="media-upload" className="btn btn-ghost media-upload-btn">
              + Add Image or Video
            </label>
          </div>
        </div>

        {/* Platform tabs */}
        <div className="form-group">
          <label>Platforms</label>
          <div className="platform-tabs">
            <div className="platform-tab-bar">
              {platforms.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`platform-tab ${activeTab === p ? 'active' : ''} ${
                    selectedPlatforms.includes(p) ? 'enabled' : 'disabled'
                  }`}
                  onClick={() => setActiveTab(p)}
                >
                  {p}
                  {selectedPlatforms.includes(p) && (
                    <span className="tab-check">&#10003;</span>
                  )}
                </button>
              ))}
            </div>

            {platforms.map((p) => {
              if (p !== activeTab) return null;
              const fields = platformOptions[p] || [];
              const isEnabled = selectedPlatforms.includes(p);

              return (
                <div key={p} className="platform-tab-content">
                  <label className="platform-enable-toggle">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => togglePlatform(p)}
                    />
                    <span>Post on {p}</span>
                  </label>

                  {isEnabled && (() => {
                    const limits = platformLimits[p];
                    const effectiveText = overrides[p] || content;
                    const maxChars = limits
                      ? (files.length > 0 && limits.maxCharsWithMedia != null ? limits.maxCharsWithMedia : limits.maxChars)
                      : null;
                    const isOverLimit = maxChars != null && effectiveText.length > maxChars;

                    return (
                    <div className="platform-tab-fields">
                      <div className="form-group">
                        <label>Override content (optional)</label>
                        <textarea
                          value={overrides[p] || ''}
                          onChange={(e) =>
                            setOverrides((prev) => ({ ...prev, [p]: e.target.value }))
                          }
                          rows={2}
                          placeholder={`Custom content for ${p}...`}
                          className={`form-textarea form-textarea-small ${isOverLimit ? 'form-textarea-error' : ''}`}
                        />
                        {maxChars != null && (
                          <span className={`char-count ${isOverLimit ? 'char-count-error' : ''}`}>
                            {effectiveText.length}/{maxChars} characters
                            {!overrides[p] && isOverLimit && ' (using base content)'}
                          </span>
                        )}
                      </div>

                      {fields.map((field) => (
                        <OptionFieldInput
                          key={field.key}
                          field={field}
                          value={options[p]?.[field.key]}
                          onChange={(value) => setOptionValue(p, field.key, value)}
                        />
                      ))}
                    </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || hasContentErrors}
          >
            {submitting ? 'Scheduling...' : 'Schedule Post'}
          </button>
        </div>
      </form>
    </div>
  );
}

function OptionFieldInput({
  field,
  value,
  onChange,
}: {
  field: OptionField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (field.type) {
    case 'boolean':
      return (
        <div className="form-group option-field">
          <label className="option-checkbox">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked || undefined)}
            />
            <span>{field.label}</span>
          </label>
          {field.description && (
            <span className="option-description">{field.description}</span>
          )}
        </div>
      );

    case 'enum':
      return (
        <div className="form-group option-field">
          <label>{field.label}</label>
          <select
            className="form-input"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value || undefined)}
          >
            <option value="">-- None --</option>
            {field.enumValues?.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          {field.description && (
            <span className="option-description">{field.description}</span>
          )}
        </div>
      );

    case 'string':
    default:
      return (
        <div className="form-group option-field">
          <label>{field.label}</label>
          <input
            type="text"
            className="form-input"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            placeholder={field.description || ''}
          />
          {field.description && (
            <span className="option-description">{field.description}</span>
          )}
        </div>
      );
  }
}
