import React, { useState, useEffect } from 'react';
import { usePlatforms, useSavePlatformCredentials, useDeletePlatformCredentials } from '../hooks';
import type { PlatformInfo, CredentialField } from '../api';
import { MetaLogin } from '../components/MetaLogin';
import { TwitterLogin } from '../components/TwitterLogin';

const PLATFORM_INSTRUCTIONS: Record<string, string> = {
  telegram: "Talk to @BotFather on Telegram to create a bot and get the Bot Token. Add the bot to your channel as an administrator to get the Channel ID (e.g., @mychannel).",
  twitter: "Create an app in the Twitter Developer Portal. Enable OAuth 1.0a with 'Read and Write' permissions to get the API Key, API Secret, Access Token, and Access Secret.",
  bluesky: "Go to Settings > App Passwords in your Bluesky account to generate an app-specific password. Do not use your main account password.",
  mastodon: "Go to Preferences > Development > New Application on your Mastodon instance to create an application and get an access token.",
  facebook: "You need a Page Access Token with 'pages_manage_posts' and 'pages_read_engagement' permissions. Create an App in the Meta for Developers portal and link your Page.",
  instagram: "Requires an Instagram Business Account linked to a Facebook Page. Get a Graph API access token with 'instagram_basic' and 'instagram_content_publish' permissions.",
};

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

type ConfigStep = 'CHOOSE_METHOD' | 'MANUAL_FORM' | 'APP_CREDENTIALS' | 'OAUTH' | 'SELECT_PAGE';

interface FacebookPage {
  access_token: string;
  name: string;
  id: string;
  instagram_business_account?: { id: string };
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
  const [step, setStep] = useState<ConfigStep>('CHOOSE_METHOD');
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [userToken, setUserToken] = useState('');
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(false);

  const isMeta = info.platform === 'facebook' || info.platform === 'instagram';
  const isTwitter = info.platform === 'twitter';
  const hasOAuth = isMeta || isTwitter;

  useEffect(() => {
    if (!isEditing) {
      setStep('CHOOSE_METHOD');
      setAppId('');
      setAppSecret('');
      setUserToken('');
      setPages([]);
    }
  }, [isEditing]);

  const handleSave = async (overrideValues?: Record<string, string>) => {
    setError(null);
    try {
      await saveMutation.mutateAsync({
        platform: info.platform,
        credentials: overrideValues || formValues
      });
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
    setFormValues(info.currentCredentials || {});
    setError(null);
    onEdit();
  };

  const handleLoginSuccess = async (token: string) => {
    if (isTwitter) return; // Should not happen with current logic
    setUserToken(token);
    setIsLoadingPages(true);
    setStep('SELECT_PAGE');
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=name,access_token,instagram_business_account&access_token=${token}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      setPages(data.data || []);
    } catch (err: any) {
      setError('Failed to fetch pages: ' + err.message);
    } finally {
      setIsLoadingPages(false);
    }
  };

  const handleTwitterLoginSuccess = (token: string, secret: string) => {
    handleSave({
      apiKey: appId,
      apiSecret: appSecret,
      accessToken: token,
      accessSecret: secret,
    });
  };

  const selectPage = (page: FacebookPage) => {
    if (info.platform === 'facebook') {
      handleSave({
        pageAccessToken: page.access_token,
        pageId: page.id,
        appId,
        appSecret,
      });
    } else {
      if (!page.instagram_business_account) {
        setError('This Facebook page is not linked to an Instagram Business account.');
        return;
      }
      handleSave({
        accessToken: page.access_token,
        accountId: page.instagram_business_account.id,
        appId,
        appSecret,
      });
    }
  };

  return (
    <div className={`platform-card ${info.configured ? 'configured' : 'unconfigured'}`}>
      <div className="platform-card-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className="platform-card-name">{info.platform}</span>
          {PLATFORM_INSTRUCTIONS[info.platform] && (
            <div className="tooltip">
              <span className="tooltip-icon">?</span>
              <span className="tooltip-text">{PLATFORM_INSTRUCTIONS[info.platform]}</span>
            </div>
          )}
        </div>
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
          {hasOAuth && step === 'CHOOSE_METHOD' && (
            <div className="method-chooser">
              <button className="btn btn-primary" onClick={() => setStep('APP_CREDENTIALS')}>
                {isTwitter ? 'Log in with Twitter' : 'Login for Business'}
              </button>
              <button className="btn btn-ghost" onClick={() => setStep('MANUAL_FORM')}>
                Manual Configuration
              </button>
            </div>
          )}

          {(!hasOAuth || step === 'MANUAL_FORM') && info.credentialFields.map((field) => (
            <CredentialFieldInput
              key={field.key}
              field={field}
              value={formValues[field.key] || ''}
              onChange={(val) => handleFieldChange(field.key, val)}
            />
          ))}

          {hasOAuth && step === 'APP_CREDENTIALS' && (
            <div className="form-group">
              <label>{isTwitter ? 'Twitter API Key' : 'Meta App ID'}</label>
              <input
                className="form-input"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder={isTwitter ? 'Enter your Twitter API Key' : 'Enter your Meta App ID'}
              />

              <label style={{ marginTop: '12px' }}>{isTwitter ? 'Twitter API Secret' : 'Meta App Secret'}</label>
              <input
                type="password"
                className="form-input"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder={isTwitter ? 'Enter your Twitter API Secret' : 'Enter your Meta App Secret'}
              />

              <p className="field-help">
                {isTwitter
                  ? 'You can find these in the Twitter Developer Portal under App Settings.'
                  : 'You can find these in the Meta for Developers portal.'}
              </p>
              <div className="step-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => appId && appSecret && setStep('OAUTH')}
                  disabled={!appId || !appSecret}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {isMeta && step === 'OAUTH' && (
            <div className="oauth-step">
              <MetaLogin
                appId={appId}
                platform={info.platform as 'facebook' | 'instagram'}
                onSuccess={handleLoginSuccess}
                onError={setError}
              />
            </div>
          )}

          {isTwitter && step === 'OAUTH' && (
            <div className="oauth-step">
              <TwitterLogin
                apiKey={appId}
                apiSecret={appSecret}
                onSuccess={handleTwitterLoginSuccess}
                onError={setError}
              />
            </div>
          )}

          {isMeta && step === 'SELECT_PAGE' && (
            <div className="page-selector">
              <h4>Select a Page</h4>
              {isLoadingPages ? <p>Loading pages...</p> : (
                <div className="page-list">
                  {pages.map(page => (
                    <button key={page.id} className="page-item" onClick={() => selectPage(page)}>
                      <span className="page-name">{page.name}</span>
                      <span className="page-id">{page.id}</span>
                    </button>
                  ))}
                  {pages.length === 0 && <p>No pages found.</p>}
                </div>
              )}
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="platform-card-form-actions">
            <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
            {(!hasOAuth || step === 'MANUAL_FORM') && (
              <button
                className="btn btn-primary"
                onClick={() => handleSave()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            )}
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
