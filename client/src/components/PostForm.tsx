import React, { useState, useRef, useMemo } from 'react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { useCreatePost, useUpdatePost, useMedia, useFileDrop } from '../hooks';
import { api, getMediaUrl } from '../api';
import type { OptionField, CharacterLimits, MediaAsset, Post, AiServiceInfo } from '../api';
import SortableMediaGrid from './SortableMediaGrid';
import InstagramMusicPicker from './InstagramMusicPicker';

interface PostFormProps {
  platforms: string[];
  platformOptions: Record<string, OptionField[]>;
  platformLimits: Record<string, CharacterLimits>;
  initialDate: Date | null;
  initialTheme?: string;
  aiServices: AiServiceInfo[];
  aiDefaultPrompt: string;
  post?: Post;
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
  platformContentEnabled: Record<string, boolean>,
  platformLimits: Record<string, CharacterLimits>,
  hasMedia: boolean,
): PlatformValidationError[] {
  const errors: PlatformValidationError[] = [];
  for (const platform of selectedPlatforms) {
    const limits = platformLimits[platform];
    if (!limits) continue;
    const text = platformContentEnabled[platform]
      ? (overrides[platform] || '')
      : content;
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

function capitalize(str: string): string {
  if (typeof str !== 'string' || str.length === 0) return str;
  return str[0].toUpperCase() + str.slice(1);
}

interface ChooseFromLibraryButtonProps {
  target: string | null;
  onClick: (target: string | null) => void;
}

const ChooseFromLibraryButton = ({ target, onClick }: ChooseFromLibraryButtonProps) => (
  <button
    type="button"
    className="btn btn-ghost media-upload-btn"
    onClick={() => onClick(target)}
  >
    Choose from library
  </button>
);

export default function PostForm({ platforms, platformOptions, platformLimits, initialDate, initialTheme, aiServices, aiDefaultPrompt, post, onClose }: PostFormProps) {
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const { data: libraryMedia = [] } = useMedia();

  const defaultDateTime = useMemo(() => {
    if (post) return format(parseISO(post.scheduled_at_utc), "yyyy-MM-dd'T'HH:mm");
    if (initialDate) return format(initialDate, "yyyy-MM-dd'T'HH:mm");
    return format(new Date(), "yyyy-MM-dd'T'HH:mm");
  }, [post, initialDate]);

  const [content, setContent] = useState(post?.base_content || '');
  const [theme, setTheme] = useState(initialTheme || '');
  const [scheduledAt, setScheduledAt] = useState(defaultDateTime);
  const [showAiModal, setShowAiModal] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    post ? post.platform_targets.map((t) => t.platform) : platforms
  );
  const [overrides, setOverrides] = useState<Record<string, string>>(
    post
      ? Object.fromEntries(
          post.platform_targets
            .filter((t) => t.override_content !== null)
            .map((t) => [t.platform, t.override_content!])
        )
      : {}
  );
  const [options, setOptions] = useState<Record<string, Record<string, unknown>>>(
    post
      ? Object.fromEntries(
          post.platform_targets
            .filter((t) => t.override_options_json)
            .map((t) => [t.platform, JSON.parse(t.override_options_json!)])
        )
      : {}
  );
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset[]>(post?.media || []);
  const [platformMediaOverrides, setPlatformMediaOverrides] = useState<Record<string, MediaAsset[]>>(
    post
      ? Object.fromEntries(
          post.platform_targets
            .filter((t) => t.override_media_json)
            .map((t) => {
              return [t.platform, []]; // Full objects matched from libraryMedia in useEffect below
            })
        )
      : {}
  );

  // Re-populate platform media overrides from library once libraryMedia is loaded
  React.useEffect(() => {
    if (post && libraryMedia.length > 0) {
      const overrides: Record<string, MediaAsset[]> = {};
      post.platform_targets.forEach((t) => {
        if (t.override_media_json) {
          const mediaIds = (JSON.parse(t.override_media_json) as { media_asset_id: string }[]).map(
            (m) => m.media_asset_id
          );
          overrides[t.platform] = libraryMedia.filter((m) => mediaIds.includes(m.id));
        }
      });
      setPlatformMediaOverrides((prev) => ({ ...prev, ...overrides }));
    }
  }, [post, libraryMedia]);

  const [platformContentEnabled, setPlatformContentEnabled] = useState<Record<string, boolean>>(
    post
      ? Object.fromEntries(post.platform_targets.map((t) => [t.platform, t.override_content !== null]))
      : {}
  );
  const [platformMediaEnabled, setPlatformMediaEnabled] = useState<Record<string, boolean>>(
    post
      ? Object.fromEntries(post.platform_targets.map((t) => [t.platform, !!t.override_media_json]))
      : {}
  );
  const [activeTab, setActiveTab] = useState(post?.platform_targets[0]?.platform || platforms[0] || '');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [libraryPickerTarget, setLibraryPickerTarget] = useState<string | null>(null); // null = base, platform name = override
  const fileInputRef = useRef<HTMLInputElement>(null);
  const platformFileInputRef = useRef<HTMLInputElement>(null);

  const { isDragging, onDragOver, onDragLeave, onDrop } = useFileDrop((files) => {
    handleFileUpload(files, null);
  });

  const handleChooseFromLibrary = (target: string | null) => {
    setLibraryPickerTarget(target);
    setShowLibraryPicker(true);
  };

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

  const toggleLibraryMedia = (asset: MediaAsset) => {
    if (libraryPickerTarget === null) {
      setSelectedMedia((prev) => {
        const exists = prev.find((m) => m.id === asset.id);
        if (exists) return prev.filter((m) => m.id !== asset.id);
        return [...prev, asset];
      });
    } else {
      setPlatformMediaOverrides((prev) => {
        const current = prev[libraryPickerTarget] || [];
        const exists = current.find((m) => m.id === asset.id);
        if (exists) return { ...prev, [libraryPickerTarget]: current.filter((m) => m.id !== asset.id) };
        return { ...prev, [libraryPickerTarget]: [...current, asset] };
      });
    }
  };

  const hasMedia = selectedMedia.length > 0;

  const contentErrors = useMemo(
    () => validateContentLimits(content, selectedPlatforms, overrides, platformContentEnabled, platformLimits, hasMedia),
    [content, selectedPlatforms, overrides, platformContentEnabled, platformLimits, hasMedia],
  );

  const platformRequirementsErrors = useMemo(() => {
    const errors: PlatformValidationError[] = [];
    selectedPlatforms.forEach((p) => {
      const effectiveText = platformContentEnabled[p]
        ? (overrides[p] || '')
        : content;
      const effectiveMedia = platformMediaEnabled[p]
        ? (platformMediaOverrides[p] || [])
        : selectedMedia;
      const hasEffectiveMedia = effectiveMedia.length > 0;
      const hasLink = !!options[p]?.link;
      const limits = platformLimits[p];

      if (limits?.requiresMedia) {
        if (!hasEffectiveMedia) {
          errors.push({ platform: p, message: 'Requires at least one image or video' });
        }
      } else {
        if (!effectiveText.trim() && !hasEffectiveMedia && !hasLink) {
          errors.push({ platform: p, message: 'Requires either text or media' });
        }
      }
    });
    return errors;
  }, [selectedPlatforms, content, overrides, platformMediaEnabled, platformMediaOverrides, selectedMedia, options]);

  const hasContentErrors = contentErrors.length > 0 || platformRequirementsErrors.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedPlatforms.length === 0) {
      setError('Select at least one platform');
      return;
    }

    const scheduledDate = new Date(scheduledAt);
    const now = new Date();
    if (differenceInMinutes(scheduledDate, now) <= 15) {
      setShowConfirmDialog(true);
      return;
    }

    await performSubmit();
  };

  const performSubmit = async () => {
    setSubmitting(true);
    setShowConfirmDialog(false);

    try {
      const payload = {
        base_content: content,
        scheduled_at_utc: new Date(scheduledAt).toISOString(),
        media_ids: selectedMedia.map((m) => m.id),
        platform_targets: selectedPlatforms.map((p) => {
          const platformOpts = options[p] || {};
          const fields = platformOptions[p] || [];

          const finalOpts = { ...platformOpts };
          fields.forEach((field) => {
            if (finalOpts[field.key] === undefined && field.defaultValue !== undefined) {
              finalOpts[field.key] = field.defaultValue;
            }
          });

          const cleanedOpts = Object.fromEntries(
            Object.entries(finalOpts).filter(
              ([, v]) => v !== undefined && v !== '' && v !== null
            )
          );

          const overrideMedia = platformMediaEnabled[p]
            ? (platformMediaOverrides[p] || []).map((m) => ({ media_asset_id: m.id }))
            : null;

          return {
            platform: p,
            override_content: platformContentEnabled[p] ? (overrides[p] || '') : null,
            override_media_json: overrideMedia,
            override_options_json:
              cleanedOpts && Object.keys(cleanedOpts).length > 0 ? cleanedOpts : null,
          };
        }),
      };

      if (post) {
        await updatePost.mutateAsync({ id: post.id, data: payload });
      } else {
        await createPost.mutateAsync(payload);
      }

      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`post-form-container ${isDragging ? 'dragging-file' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="post-form-header">
        <h2>{post ? 'Edit' : 'Schedule'}</h2>
        <button className="btn btn-ghost" onClick={onClose}>&times;</button>
      </div>

      <form onSubmit={handleSubmit} className="post-form">
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <label>Post theme</label>
          <input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Optional theme or topic for this post..."
            className="form-input"
          />
        </div>

        <div className="form-group">
          <div className="content-label-row">
            <label>Content</label>
            {aiServices.length > 0 && (
              <button
                type="button"
                className="btn-magic-pencil"
                onClick={() => setShowAiModal(true)}
                title="Generate with AI"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 4L12 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M13 1L15 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="3.5" cy="3.5" r="1" fill="currentColor" opacity="0.6"/>
                  <circle cx="14" cy="12" r="0.8" fill="currentColor" opacity="0.5"/>
                  <circle cx="6" cy="1.5" r="0.6" fill="currentColor" opacity="0.4"/>
                </svg>
              </button>
            )}
          </div>
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
          {platformRequirementsErrors.length > 0 && (
            <div className="content-limit-errors">
              {platformRequirementsErrors.map((err) => (
                <span key={err.platform} className="content-limit-error">
                  {err.platform}: {err.message}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Schedule date and time</label>
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
              <SortableMediaGrid
                items={selectedMedia}
                onReorder={setSelectedMedia}
                onRemove={removeSelectedMedia}
                showSize
              />
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
                {uploading ? 'Uploading...' : '+ Upload new'}
              </label>
              <ChooseFromLibraryButton target={null} onClick={handleChooseFromLibrary} />
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
                    <span>Post on {capitalize(p)}</span>
                  </label>

                  {isEnabled && (() => {
                    const limits = platformLimits[p];
                    const effectiveText = platformContentEnabled[p]
                      ? (overrides[p] || '')
                      : content;
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
                        <label className="platform-enable-toggle">
                          <input
                            type="checkbox"
                            checked={!!platformContentEnabled[p]}
                            onChange={() => setPlatformContentEnabled((prev) => ({ ...prev, [p]: !prev[p] }))}
                          />
                          <span>Override content for {capitalize(p)}</span>
                        </label>
                        {platformContentEnabled[p] && (
                          <>
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
                              </span>
                            )}
                          </>
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
                          <span>Override media for {capitalize(p)}</span>
                        </label>
                        {platformMediaEnabled[p] && (
                          <div className="media-upload-area platform-media-override">
                            {(platformMediaOverrides[p] || []).length > 0 && (
                              <SortableMediaGrid
                                items={platformMediaOverrides[p] || []}
                                onReorder={(newItems) => setPlatformMediaOverrides((prev) => ({ ...prev, [p]: newItems }))}
                                onRemove={(index) => removePlatformMedia(p, index)}
                              />
                            )}
                            <div className="media-action-buttons">
                              <ChooseFromLibraryButton target={p} onClick={handleChooseFromLibrary} />
                            </div>
                          </div>
                        )}
                      </div>

                      {fields.map((field) => (
                        <OptionFieldInput
                          key={field.key}
                          field={field}
                          platform={p}
                          value={options[p]?.[field.key]}
                          onChange={(value) => setOptionValue(p, field.key, value)}
                          setOptionValue={setOptionValue}
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
            {submitting ? (post ? 'Updating...' : 'Scheduling...') : (post ? 'Update' : 'Schedule')}
          </button>
        </div>
      </form>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="modal-overlay" onClick={() => setShowConfirmDialog(false)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm schedule</h3>
              <button className="btn btn-ghost" onClick={() => setShowConfirmDialog(false)}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              <p>This post is scheduled to be published in less than 15 minutes. Are you sure you want to proceed?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowConfirmDialog(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={performSubmit}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Media Library Picker Modal */}
      {showLibraryPicker && (
        <MediaLibraryPicker
          media={libraryMedia}
          onToggle={toggleLibraryMedia}
          onUpload={async (file) => {
            const asset = await api.uploadMedia(file);
            toggleLibraryMedia(asset);
          }}
          onClose={() => setShowLibraryPicker(false)}
          selectedIds={
            libraryPickerTarget === null
              ? selectedMedia.map((m) => m.id)
              : (platformMediaOverrides[libraryPickerTarget] || []).map((m) => m.id)
          }
        />
      )}

      {/* AI Generation Modal */}
      {showAiModal && (
        <AiGenerateModal
          aiServices={aiServices}
          defaultPrompt={aiDefaultPrompt}
          theme={theme}
          platforms={selectedPlatforms}
          platformLimits={platformLimits}
          onInsert={(text) => {
            setContent(text);
            setShowAiModal(false);
          }}
          onClose={() => setShowAiModal(false)}
        />
      )}
    </div>
  );
}

function MediaLibraryPicker({
  media,
  onToggle,
  onUpload,
  onClose,
  selectedIds,
}: {
  media: MediaAsset[];
  onToggle: (asset: MediaAsset) => void;
  onUpload: (file: File) => Promise<void>;
  onClose: () => void;
  selectedIds: string[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { isDragging, onDragOver, onDragLeave, onDrop } = useFileDrop(async (files) => {
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await onUpload(files[i]);
      }
    } finally {
      setUploading(false);
    }
  });

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
      <div
        className={`modal-content media-picker-modal ${isDragging ? 'dragging-file' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="modal-header">
          <h3>Media</h3>
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
            {uploading ? 'Uploading...' : '+ Upload new'}
          </label>
        </div>
        <div className="media-picker-grid">
          {media.length === 0 && (
            <div className="media-picker-empty">No media in library. Upload some files first.</div>
          )}
          {media.map((asset) => {
            const orderIndex = selectedIds.indexOf(asset.id);
            const isSelected = orderIndex !== -1;
            return (
              <button
                key={asset.id}
                type="button"
                className={`media-picker-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onToggle(asset)}
              >
                {asset.type === 'image' ? (
                  <img src={getMediaUrl(asset)} alt="" className="media-picker-thumb" />
                ) : (
                  <div className="media-picker-video-thumb">
                    <span>&#9654;</span>
                  </div>
                )}
                <span className="media-picker-name">{asset.original_filename || asset.id.slice(0, 8)}</span>
                {isSelected && <span className="media-picker-order">{orderIndex + 1}</span>}
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

function substitutePrompt(
  template: string,
  vars: { platform?: string; char_limit?: string; theme?: string },
): string {
  let result = template;
  result = result.replace(/\{\{platform\}\}/g, vars.platform || 'social media');
  result = result.replace(/\{\{char_limit\}\}/g, vars.char_limit || 'no limit');
  result = result.replace(/\{\{theme\}\}/g, vars.theme || '(no theme specified)');
  return result;
}

function AiGenerateModal({
  aiServices,
  defaultPrompt,
  theme,
  platforms,
  platformLimits,
  onInsert,
  onClose,
}: {
  aiServices: AiServiceInfo[];
  defaultPrompt: string;
  theme: string;
  platforms: string[];
  platformLimits: Record<string, CharacterLimits>;
  onInsert: (text: string) => void;
  onClose: () => void;
}) {
  const [selectedServiceId, setSelectedServiceId] = useState(aiServices[0]?.id || '');

  // Build initial prompt with substitution
  const lowestLimit = useMemo(() => {
    const limits = platforms.map((p) => platformLimits[p]?.maxChars).filter(Boolean);
    return limits.length > 0 ? Math.min(...limits) : undefined;
  }, [platforms, platformLimits]);

  const initialPrompt = useMemo(() => {
    const tmpl = defaultPrompt || 'Write a social media post for {{platform}} (max {{char_limit}} characters) about: {{theme}}';
    return substitutePrompt(tmpl, {
      platform: platforms.join(', ') || 'social media',
      char_limit: lowestLimit ? String(lowestLimit) : 'no limit',
      theme: theme || '(no theme specified)',
    });
  }, [defaultPrompt, platforms, lowestLimit, theme]);

  const [prompt, setPrompt] = useState(initialPrompt);
  const [generatedText, setGeneratedText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!selectedServiceId || !prompt.trim()) return;
    setGenerating(true);
    setError(null);
    setGeneratedText('');
    try {
      const result = await api.generateAiText(selectedServiceId, prompt);
      setGeneratedText(result.text);
    } catch (err: any) {
      setError(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ai-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Generate with AI</h3>
          <button className="btn btn-ghost" onClick={onClose}>&times;</button>
        </div>
        <div className="ai-modal-body">
          <div className="form-group">
            <label>AI Service</label>
            <input
              list="ai-services-list"
              className="form-input"
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              placeholder="Select an AI service..."
            />
            <datalist id="ai-services-list">
              {aiServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.model ? ` (${s.model})` : ''}
                </option>
              ))}
            </datalist>
          </div>
          <div className="form-group">
            <label>Prompt</label>
            <textarea
              className="form-textarea"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <span className="option-description">
              Use {'{{platform}}'}, {'{{char_limit}}'}, {'{{theme}}'} for substitution
            </span>
          </div>
          {error && <div className="form-error">{error}</div>}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={generating || !selectedServiceId}
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
          {generatedText && (
            <div className="form-group">
              <label>Result</label>
              <textarea
                className="form-textarea"
                rows={6}
                value={generatedText}
                onChange={(e) => setGeneratedText(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onInsert(generatedText)}
            disabled={!generatedText.trim()}
          >
            Use this text
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionFieldInput({
  field,
  platform,
  value,
  onChange,
  setOptionValue,
}: {
  field: OptionField;
  platform: string;
  value: unknown;
  onChange: (value: unknown) => void;
  setOptionValue: (platform: string, key: string, value: unknown) => void;
}) {
  const effectiveValue = value !== undefined ? value : field.defaultValue;

  // Special handling for Instagram music picker
  if (field.key === 'audio_id' && platform === 'instagram') {
    return (
      <div className="form-group option-field">
        <label>{field.label}</label>
        <InstagramMusicPicker
          value={effectiveValue as string | undefined}
          onChange={(trackId, trackName, artistName) => {
            onChange(trackId);
            if (trackName) setOptionValue(platform, 'audio_name', trackName);
            if (artistName) setOptionValue(platform, 'audio_artist', artistName);
          }}
        />
        {field.description && (
          <span className="option-description">{field.description}</span>
        )}
      </div>
    );
  }

  switch (field.type) {
    case 'boolean':
      return (
        <div className="form-group option-field">
          <label className="option-checkbox">
            <input
              type="checkbox"
              checked={!!effectiveValue}
              onChange={(e) => onChange(e.target.checked)}
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
            value={(effectiveValue as string) || ''}
            onChange={(e) => onChange(e.target.value || undefined)}
          >
            {!field.defaultValue && <option value="">-- None --</option>}
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
            value={(effectiveValue as string) || ''}
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
