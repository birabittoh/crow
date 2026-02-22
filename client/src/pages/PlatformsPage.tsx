import React, { useState, useEffect } from 'react';
import { usePlatforms, useSavePlatformCredentials, useDeletePlatformCredentials, useAiServices, useSaveAiService, useDeleteAiService, useFetchAiModels, useAiDefaultPrompt, useSaveAiDefaultPrompt } from '../hooks';
import type { PlatformInfo, CredentialField, AiServiceFull } from '../api';
import { MetaLogin } from '../components/MetaLogin';
import { TwitterLogin } from '../components/TwitterLogin';

const PLATFORM_INSTRUCTIONS: Record<string, string> = {
  telegram: "Talk to @BotFather on Telegram to create a bot and get the Bot Token. Add the bot to your channel as an administrator to get the Channel ID (e.g., @mychannel).",
  twitter: "Create an app in the Twitter Developer Portal. Enable OAuth 1.0a with 'Read and Write' permissions to get the API Key, API Secret, Access Token, and Access Secret.",
  bluesky: "Go to Settings > App Passwords in your Bluesky account to generate an app-specific password. Do not use your main account password.",
  mastodon: "Go to Preferences > Development > New Application on your Mastodon instance to create an application and get an access token.",
  facebook: "You need a Page Access Token with 'pages_manage_posts' and 'pages_read_engagement' permissions. Create an App in the Meta for Developers portal and link your Page.",
  instagram: "Requires an Instagram Business Account linked to a Facebook Page. Get a Graph API access token with 'instagram_basic' and 'instagram_content_publish' permissions.",
  discord: "Create a bot in the Discord Developer Portal and get the Bot Token. Add the bot to your server with 'Send Messages' and 'Attach Files' permissions. Get the Channel ID by right-clicking a channel (requires Developer Mode enabled).",
  threads: "Requires a Threads account. Get a Threads API access token with proper permissions from the Meta for Developers portal. You'll also need your Threads User ID.",
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
        <h2>Platforms</h2>
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

      <AiServicesSection />
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

const PREMADE_CONFIGS = [
  { id: 'openai',      name: 'OpenAI',          api_url: 'https://api.openai.com/v1/chat/completions',            type: 'openai' },
  { id: 'openrouter',  name: 'OpenRouter',       api_url: 'https://openrouter.ai/api/v1/chat/completions',         type: 'openai' },
  { id: 'groq',        name: 'Groq',             api_url: 'https://api.groq.com/openai/v1/chat/completions',       type: 'openai' },
  { id: 'ollama',      name: 'Ollama (local)',    api_url: 'http://localhost:11434/v1/chat/completions',            type: 'openai' },
  { id: 'gemini',      name: 'Google Gemini',    api_url: 'https://generativelanguage.googleapis.com/v1beta',      type: 'gemini' },
] as const;

function AiServicesSection() {
  const { data: services = [] } = useAiServices();
  const { data: promptData } = useAiDefaultPrompt();
  const saveMutation = useSaveAiService();
  const deleteMutation = useDeleteAiService();
  const savePromptMutation = useSaveAiDefaultPrompt();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', api_url: '', api_key: '', model: '', type: 'openai' });
  const [error, setError] = useState<string | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [promptDirty, setPromptDirty] = useState(false);
  const [showConfirmRemove, setShowConfirmRemove] = useState<string | null>(null);
  const fetchModelsMutation = useFetchAiModels();
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  useEffect(() => {
    if (promptData?.prompt !== undefined && !promptDirty) {
      setPromptValue(promptData.prompt);
    }
  }, [promptData, promptDirty]);

  const startEditing = (service: AiServiceFull) => {
    setForm({
      id: service.id,
      name: service.name,
      api_url: service.api_url,
      api_key: service.api_key.startsWith('***') ? '' : service.api_key,
      model: service.model,
      type: service.type || 'openai',
    });
    setError(null);
    setEditingId(service.id);
    setIsAdding(false);
  };

  const startAdding = () => {
    setForm({ id: '', name: '', api_url: '', api_key: '', model: '', type: 'openai' });
    setError(null);
    setIsAdding(true);
    setEditingId(null);
  };

  const handleSave = async () => {
    setError(null);
    const id = isAdding ? form.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') : editingId!;
    if (!id || !form.name || !form.api_url || !form.api_key) {
      setError('All fields except Model are required');
      return;
    }
    try {
      await saveMutation.mutateAsync({
        id,
        data: { name: form.name, api_url: form.api_url, api_key: form.api_key, model: form.model, type: form.type },
      });
      setEditingId(null);
      setIsAdding(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      setShowConfirmRemove(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    }
  };

  const handleSavePrompt = async () => {
    try {
      await savePromptMutation.mutateAsync(promptValue);
      setPromptDirty(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save prompt');
    }
  };

  const handleFetchModels = async () => {
    setError(null);
    try {
      let result;
      if (editingId && !form.api_key) {
        result = await fetchModelsMutation.mutateAsync({ service_id: editingId });
      } else {
        if (!form.api_url || !form.api_key) {
          setError('API URL and API Key are required to fetch models');
          return;
        }
        result = await fetchModelsMutation.mutateAsync({ api_url: form.api_url, api_key: form.api_key, type: form.type });
      }
      setAvailableModels(result.models);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch models');
    }
  };

  return (
    <>
      <h3 className="ai-section-title">AI Services</h3>
      <p className="platforms-description">
        Configure AI text generation services (OpenAI-compatible or Google Gemini). These can be used to generate post content from the post editor.
      </p>

      <div className="platforms-grid">
        {services.map((service) => (
          <div key={service.id} className={`platform-card ${editingId === service.id ? '' : 'configured'}`}>
            <div className="platform-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="platform-card-name">{service.name}</span>
                <span className="ai-service-id">{service.id}</span>
              </div>
              <span className="platform-card-status status-configured">
                {service.model || 'No model'}
              </span>
            </div>

            {editingId !== service.id && (
              <div className="platform-card-actions">
                <button className="btn btn-ghost" onClick={() => startEditing(service)}>Update</button>
                <button className="btn btn-danger" onClick={() => setShowConfirmRemove(service.id)}>Remove</button>
              </div>
            )}

            {editingId === service.id && (
              <div className="platform-card-form">
                <div className="form-group">
                  <label>Name</label>
                  <input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. OpenRouter GPT-4o" />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select className="form-input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                    <option value="openai">OpenAI-compatible</option>
                    <option value="gemini">Google Gemini</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{form.type === 'gemini' ? 'Base URL' : 'API URL'}</label>
                  <input className="form-input" value={form.api_url} onChange={(e) => setForm((f) => ({ ...f, api_url: e.target.value }))} placeholder={form.type === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' : 'https://openrouter.ai/api/v1/chat/completions'} />
                </div>
                <div className="form-group">
                  <label>API Key</label>
                  <input type="password" className="form-input" value={form.api_key} onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))} placeholder="Enter API key" />
                </div>
                <div className="form-group">
                  <label>Model</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input className="form-input" list="ai-models-list" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="e.g. gpt-4o-mini (optional)" />
                    <button className="btn btn-ghost" type="button" onClick={handleFetchModels} disabled={fetchModelsMutation.isPending}>
                      {fetchModelsMutation.isPending ? 'Loading...' : 'Fetch models'}
                    </button>
                  </div>
                  <datalist id="ai-models-list">
                    {availableModels.map((m) => <option key={m} value={m} />)}
                  </datalist>
                </div>
                {error && <div className="form-error">{error}</div>}
                <div className="platform-card-form-actions">
                  <button className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSave} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            {showConfirmRemove === service.id && (
              <div className="modal-overlay" onClick={() => setShowConfirmRemove(null)}>
                <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Remove {service.name}?</h3>
                    <button className="btn btn-ghost" onClick={() => setShowConfirmRemove(null)}>&times;</button>
                  </div>
                  <div style={{ padding: '20px' }}>
                    <p>This will remove the AI service "{service.name}" and its API key.</p>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={() => setShowConfirmRemove(null)}>Cancel</button>
                    <button className="btn btn-danger" onClick={() => handleDelete(service.id)}>Remove</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {isAdding && (
          <div className="platform-card">
            <div className="platform-card-form">
              <div className="form-group">
                <label>Quick setup</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {PREMADE_CONFIGS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                      onClick={() => setForm((f) => ({ ...f, id: preset.id, name: preset.name, api_url: preset.api_url, type: preset.type }))}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Service ID</label>
                <input className="form-input" value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} placeholder="e.g. openrouter" />
              </div>
              <div className="form-group">
                <label>Name</label>
                <input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. OpenRouter" />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select className="form-input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  <option value="openai">OpenAI-compatible</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </div>
              <div className="form-group">
                <label>{form.type === 'gemini' ? 'Base URL' : 'API URL'}</label>
                <input className="form-input" value={form.api_url} onChange={(e) => setForm((f) => ({ ...f, api_url: e.target.value }))} placeholder={form.type === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' : 'https://openrouter.ai/api/v1/chat/completions'} />
              </div>
              <div className="form-group">
                <label>API Key</label>
                <input type="password" className="form-input" value={form.api_key} onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))} placeholder="Enter API key" />
              </div>
              <div className="form-group">
                <label>Model</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="form-input" list="ai-models-list" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="e.g. gpt-4o-mini (optional)" />
                  <button className="btn btn-ghost" type="button" onClick={handleFetchModels} disabled={fetchModelsMutation.isPending}>
                    {fetchModelsMutation.isPending ? 'Loading...' : 'Fetch models'}
                  </button>
                </div>
                <datalist id="ai-models-list">
                  {availableModels.map((m) => <option key={m} value={m} />)}
                </datalist>
              </div>
              {error && <div className="form-error">{error}</div>}
              <div className="platform-card-form-actions">
                <button className="btn btn-ghost" onClick={() => setIsAdding(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        )}

        {!isAdding && editingId === null && (
          <button className="btn btn-ghost ai-add-service-btn" onClick={startAdding}>
            + Add AI service
          </button>
        )}
      </div>

      <h3 className="ai-section-title">Default AI Prompt</h3>
      <p className="platforms-description">
        Template for AI text generation. Use {'{{platform}}'}, {'{{char_limit}}'}, {'{{theme}}'} as placeholders.
      </p>
      <div className="ai-prompt-editor">
        <textarea
          className="form-textarea"
          rows={5}
          value={promptValue}
          onChange={(e) => { setPromptValue(e.target.value); setPromptDirty(true); }}
          placeholder="e.g. Write a social media post for {{platform}} (max {{char_limit}} characters) about: {{theme}}"
        />
        {promptDirty && (
          <div className="ai-prompt-actions">
            <button className="btn btn-ghost" onClick={() => { setPromptValue(promptData?.prompt || ''); setPromptDirty(false); }}>
              Discard
            </button>
            <button className="btn btn-primary" onClick={handleSavePrompt} disabled={savePromptMutation.isPending}>
              {savePromptMutation.isPending ? 'Saving...' : 'Save prompt'}
            </button>
          </div>
        )}
      </div>
    </>
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
