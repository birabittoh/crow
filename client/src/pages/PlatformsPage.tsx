import React, { useState } from 'react';
import { usePlatforms, useSavePlatformCredentials, useDeletePlatformCredentials } from '../hooks';
import type { PlatformInfo, CredentialField } from '../api';

interface PlatformsPageProps {
  onClose: () => void;
}

export default function PlatformsPage({ onClose }: PlatformsPageProps) {
  const { data: platforms, isLoading } = usePlatforms();
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);

  if (isLoading) {
    return <div className="loading">Loading platforms...</div>;
  }

  return (
    <div className="platforms-page">
      <div className="page-header">
        <h2>Platform Configuration</h2>
        <button className="btn btn-ghost" onClick={onClose}>&times;</button>
      </div>
      <p className="platforms-description">
        Configure credentials for each platform. Posts can only be scheduled to platforms with valid credentials.
      </p>
      <div className="platforms-grid">
        {platforms?.map((info) => (
          <PlatformCard
            key={info.platform}
            info={info}
            isEditing={editingPlatform === info.platform}
            onEdit={() => setEditingPlatform(info.platform)}
            onCancel={() => setEditingPlatform(null)}
            onSaved={() => setEditingPlatform(null)}
          />
        ))}
      </div>
    </div>
  );
}

function PlatformCard({
  info,
  isEditing,
  onEdit,
  onCancel,
  onSaved,
}: {
  info: PlatformInfo;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const saveMutation = useSavePlatformCredentials();
  const deleteMutation = useDeletePlatformCredentials();
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);

  const handleSave = async () => {
    setError(null);
    try {
      await saveMutation.mutateAsync({ platform: info.platform, credentials: formValues });
      setFormValues({});
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save credentials');
    }
  };

  const handleRemove = async () => {
    setError(null);
    try {
      await deleteMutation.mutateAsync(info.platform);
      setShowConfirmRemove(false);
    } catch (err: any) {
      setError(err.message || 'Failed to remove credentials');
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const startEditing = () => {
    setFormValues({});
    setError(null);
    onEdit();
  };

  return (
    <div className={`platform-card ${info.configured ? 'configured' : 'unconfigured'}`}>
      <div className="platform-card-header">
        <span className="platform-card-name">{info.platform}</span>
        <span className={`platform-card-status ${info.configured ? 'status-configured' : 'status-unconfigured'}`}>
          {info.configured ? 'Configured' : 'Not configured'}
        </span>
      </div>

      {!isEditing && (
        <div className="platform-card-actions">
          {info.configured ? (
            <>
              <button className="btn btn-ghost" onClick={startEditing}>Update</button>
              <button
                className="btn btn-danger"
                onClick={() => setShowConfirmRemove(true)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Removing...' : 'Remove'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={startEditing}>Configure</button>
          )}
        </div>
      )}

      {isEditing && (
        <div className="platform-card-form">
          {info.credentialFields.map((field) => (
            <CredentialFieldInput
              key={field.key}
              field={field}
              value={formValues[field.key] || ''}
              onChange={(val) => handleFieldChange(field.key, val)}
            />
          ))}
          {error && <div className="form-error">{error}</div>}
          <div className="platform-card-form-actions">
            <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {showConfirmRemove && (
        <div className="modal-overlay" onClick={() => setShowConfirmRemove(false)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Remove {info.platform}?</h3>
              <button className="btn btn-ghost" onClick={() => setShowConfirmRemove(false)}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              <p>
                This will remove the credentials for {info.platform}. Scheduled posts targeting this
                platform will fail when they try to publish.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowConfirmRemove(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleRemove}>
                {deleteMutation.isPending ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CredentialFieldInput({
  field,
  value,
  onChange,
}: {
  field: CredentialField;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="form-group">
      <label>{field.label}</label>
      <input
        type={field.type === 'password' ? 'password' : 'text'}
        className="form-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || ''}
        autoComplete="off"
      />
    </div>
  );
}
