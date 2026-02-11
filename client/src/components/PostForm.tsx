import React, { useState, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { useCreatePost, useMedia } from '../hooks';
import { api, getMediaUrl } from '../api';
import type { OptionField, CharacterLimits, MediaAsset } from '../api';

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

export default function PostForm({ platforms, platformOptions, platformLimits, initialDate, onClose }: PostFormProps) {
  const createPost = useCreatePost();
  const { data: libraryMedia = [] } = useMedia();

  const defaultDateTime = initialDate
    ? format(initialDate, "yyyy-MM-dd'T'HH:mm")
    : format(new Date(), "yyyy-MM-dd'T'HH:mm");

  const [content, setContent] = useState('');
  const [scheduledAt, setScheduledAt] = useState(defaultDateTime);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(platforms);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, Record<string, unknown>>>({});
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset[]>([]);
  const [platformMediaOverrides, setPlatformMediaOverrides] = useState<Record<string, MediaAsset[]>>({});
  const [platformMediaEnabled, setPlatformMediaEnabled] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState(platforms[0] || '');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [libraryPickerTarget, setLibraryPickerTarget] = useState<string | null>(null); // null = base, platform name = override
  const fileInputRef = useRef<HTMLInputElement>(null);
  const platformFileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = async (files: FileList, target: string | null) => {
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) continue;

        const asset = await api.uploadMedia(file);
        if (target === null) {
          setSelectedMedia((prev) => [...prev, asset]);
        } else {
          setPlatformMediaOverrides((prev) => ({
            ...prev,
            [target]: [...(prev[target] || []), asset],
          }));
        }
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleBaseFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFileUpload(e.target.files, null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePlatformFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && libraryPickerTarget) handleFileUpload(e.target.files, libraryPickerTarget);
    if (platformFileInputRef.current) platformFileInputRef.current.value = '';
  };

  const removeSelectedMedia = (index: number) => {
    setSelectedMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const removePlatformMedia = (platform: string, index: number) => {
    setPlatformMediaOverrides((prev) => ({
      ...prev,
      [platform]: (prev[platform] || []).filter((_, i) => i !== index),
    }));
  };

  const addFromLibrary = (asset: MediaAsset) => {
    if (libraryPickerTarget === null) {
      if (!selectedMedia.find((m) => m.id === asset.id)) {
        setSelectedMedia((prev) => [...prev, asset]);
      }
    } else {
      const current = platformMediaOverrides[libraryPickerTarget] || [];
      if (!current.find((m) => m.id === asset.id)) {
        setPlatformMediaOverrides((prev) => ({
          ...prev,
          [libraryPickerTarget]: [...current, asset],
        }));
      }
    }
  };

  const hasMedia = selectedMedia.length > 0;

  const contentErrors = useMemo(
    () => validateContentLimits(content, selectedPlatforms, overrides, platformLimits, hasMedia),
    [content, selectedPlatforms, overrides, platformLimits, hasMedia],
  );

  const PLATFORMS_REQUIRING_MEDIA = ['instagram'];
  const mediaRequiredPlatforms = selectedPlatforms.filter(
    (p) => PLATFORMS_REQUIRING_MEDIA.includes(p) && !hasMedia && !(platformMediaEnabled[p] && (platformMediaOverrides[p] || []).length > 0)
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
      await createPost.mutateAsync({
        base_content: content,
        scheduled_at_utc: new Date(scheduledAt).toISOString(),
        media_ids: selectedMedia.map((m) => m.id),
        platform_targets: selectedPlatforms.map((p) => {
          const platformOpts = options[p];
          const cleanedOpts = platformOpts
            ? Object.fromEntries(
                Object.entries(platformOpts).filter(
                  ([, v]) => v !== undefined && v !== '' && v !== null
                )
              )
            : null;

          const overrideMedia = platformMediaEnabled[p] && platformMediaOverrides[p]?.length
            ? platformMediaOverrides[p].map((m) => ({ media_asset_id: m.id }))
            : null;

          return {
            platform: p,
            override_content: overrides[p] || null,
            override_media_json: overrideMedia,
            override_options_json:
              cleanedOpts && Object.keys(cleanedOpts).length > 0 ? cleanedOpts : null,
          };
        }),
      });

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

        {/* Media selection */}
        <div className="form-group">
          <label>Media</label>
          <div className="media-upload-area">
            {selectedMedia.length > 0 && (
              <div className="media-preview-grid">
                {selectedMedia.map((m, i) => (
                  <div key={m.id} className="media-preview-item">
                    {m.type === 'image' ? (
                      <img src={getMediaUrl(m)} alt="" className="media-preview-img" />
                    ) : (
                      <div className="media-preview-video">
                        <span className="media-preview-video-icon">&#9654;</span>
                        <span className="media-preview-filename">{m.original_filename || 'video'}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      className="media-remove-btn"
                      onClick={() => removeSelectedMedia(i)}
                    >
                      &times;
                    </button>
                    <span className="media-preview-size">
                      {(m.size_bytes / 1024).toFixed(0)} KB
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="media-action-buttons">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4"
                multiple
                onChange={handleBaseFileSelect}
                className="media-file-input"
                id="media-upload"
              />
              <label htmlFor="media-upload" className="btn btn-ghost media-upload-btn">
                {uploading ? 'Uploading...' : '+ Upload New'}
              </label>
              <button
                type="button"
                className="btn btn-ghost media-upload-btn"
                onClick={() => { setLibraryPickerTarget(null); setShowLibraryPicker(true); }}
              >
                Choose from Library
              </button>
            </div>
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
                    const effectiveHasMedia = platformMediaEnabled[p]
                      ? (platformMediaOverrides[p] || []).length > 0
                      : hasMedia;
                    const maxChars = limits
                      ? (effectiveHasMedia && limits.maxCharsWithMedia != null ? limits.maxCharsWithMedia : limits.maxChars)
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

                      {/* Per-platform media override */}
                      <div className="form-group">
                        <label className="platform-enable-toggle">
                          <input
                            type="checkbox"
                            checked={!!platformMediaEnabled[p]}
                            onChange={() => setPlatformMediaEnabled((prev) => ({ ...prev, [p]: !prev[p] }))}
                          />
                          <span>Override media for {p}</span>
                        </label>
                        {platformMediaEnabled[p] && (
                          <div className="media-upload-area platform-media-override">
                            {(platformMediaOverrides[p] || []).length > 0 && (
                              <div className="media-preview-grid">
                                {(platformMediaOverrides[p] || []).map((m, i) => (
                                  <div key={m.id} className="media-preview-item">
                                    {m.type === 'image' ? (
                                      <img src={getMediaUrl(m)} alt="" className="media-preview-img" />
                                    ) : (
                                      <div className="media-preview-video">
                                        <span className="media-preview-video-icon">&#9654;</span>
                                        <span className="media-preview-filename">{m.original_filename || 'video'}</span>
                                      </div>
                                    )}
                                    <button
                                      type="button"
                                      className="media-remove-btn"
                                      onClick={() => removePlatformMedia(p, i)}
                                    >
                                      &times;
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="media-action-buttons">
                              <button
                                type="button"
                                className="btn btn-ghost media-upload-btn"
                                onClick={() => { setLibraryPickerTarget(p); setShowLibraryPicker(true); }}
                              >
                                Choose from Library
                              </button>
                            </div>
                          </div>
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
            disabled={submitting || hasContentErrors || uploading}
          >
            {submitting ? 'Scheduling...' : 'Schedule Post'}
          </button>
        </div>
      </form>

      {/* Media Library Picker Modal */}
      {showLibraryPicker && (
        <MediaLibraryPicker
          media={libraryMedia}
          onSelect={addFromLibrary}
          onUpload={async (file) => {
            const asset = await api.uploadMedia(file);
            addFromLibrary(asset);
          }}
          onClose={() => setShowLibraryPicker(false)}
          alreadySelected={
            libraryPickerTarget === null
              ? selectedMedia.map((m) => m.id)
              : (platformMediaOverrides[libraryPickerTarget] || []).map((m) => m.id)
          }
        />
      )}
    </div>
  );
}

function MediaLibraryPicker({
  media,
  onSelect,
  onUpload,
  onClose,
  alreadySelected,
}: {
  media: MediaAsset[];
  onSelect: (asset: MediaAsset) => void;
  onUpload: (file: File) => Promise<void>;
  onClose: () => void;
  alreadySelected: string[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setUploading(true);
    try {
      for (let i = 0; i < e.target.files.length; i++) {
        await onUpload(e.target.files[i]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content media-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Media Library</h3>
          <button className="btn btn-ghost" onClick={onClose}>&times;</button>
        </div>
        <div className="media-picker-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4"
            multiple
            onChange={handleUpload}
            className="media-file-input"
            id="picker-upload"
          />
          <label htmlFor="picker-upload" className="btn btn-ghost">
            {uploading ? 'Uploading...' : '+ Upload New'}
          </label>
        </div>
        <div className="media-picker-grid">
          {media.length === 0 && (
            <div className="media-picker-empty">No media in library. Upload some files first.</div>
          )}
          {media.map((asset) => {
            const isSelected = alreadySelected.includes(asset.id);
            return (
              <button
                key={asset.id}
                type="button"
                className={`media-picker-item ${isSelected ? 'selected' : ''}`}
                onClick={() => { if (!isSelected) onSelect(asset); }}
                disabled={isSelected}
              >
                {asset.type === 'image' ? (
                  <img src={getMediaUrl(asset)} alt="" className="media-picker-thumb" />
                ) : (
                  <div className="media-picker-video-thumb">
                    <span>&#9654;</span>
                  </div>
                )}
                <span className="media-picker-name">{asset.original_filename || asset.id.slice(0, 8)}</span>
                {isSelected && <span className="media-picker-check">&#10003;</span>}
              </button>
            );
          })}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
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
