import React, { useState, useEffect } from 'react';

interface TwitterLoginProps {
  apiKey: string;
  apiSecret: string;
  onSuccess: (accessToken: string, accessSecret: string) => void;
  onError: (error: string) => void;
}

export function TwitterLogin({ apiKey, apiSecret, onSuccess, onError }: TwitterLoginProps) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'TWITTER_OAUTH_SUCCESS') {
        onSuccess(event.data.accessToken, event.data.accessSecret);
        setLoading(false);
      } else if (event.data.type === 'TWITTER_OAUTH_ERROR') {
        onError(event.data.error);
        setLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSuccess, onError]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/platforms/twitter/oauth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, apiSecret, origin: window.location.origin }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${res.status}`);
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const width = 600;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      window.open(
        data.url,
        'twitter-oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (err: any) {
      onError(err.message);
      setLoading(false);
    }
  };

  return (
    <button
      className="btn btn-login btn-twitter"
      onClick={handleLogin}
      disabled={loading || !apiKey || !apiSecret}
      type="button"
    >
      {loading ? 'Opening Twitter...' : 'Log in with Twitter'}
    </button>
  );
}
