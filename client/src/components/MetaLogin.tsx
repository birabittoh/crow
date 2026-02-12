import React, { useEffect, useState } from 'react';

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
  }
}

interface MetaLoginProps {
  appId: string;
  onSuccess: (accessToken: string) => void;
  onError: (error: string) => void;
  platform: 'facebook' | 'instagram';
}

export function MetaLogin({ appId, onSuccess, onError, platform }: MetaLoginProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const initFB = () => {
      window.FB.init({
        appId: appId,
        cookie: true,
        xfbml: true,
        version: 'v21.0'
      });
      setIsLoaded(true);
    };

    if (window.FB) {
      initFB();
    } else {
      window.fbAsyncInit = initFB;

      (function(d, s, id) {
        var js, fjs = d.getElementsByTagName(s)[0];
        if (d.getElementById(id)) return;
        js = d.createElement(s) as HTMLScriptElement;
        js.id = id;
        js.src = "https://connect.facebook.net/en_US/sdk.js";
        if (fjs && fjs.parentNode) {
          fjs.parentNode.insertBefore(js, fjs);
        }
      }(document, 'script', 'facebook-jssdk'));
    }
  }, [appId]);

  const handleLogin = () => {
    if (!window.FB) {
      onError('Facebook SDK not loaded');
      return;
    }

    const scope = platform === 'facebook'
      ? 'pages_manage_posts,pages_read_engagement,pages_show_list'
      : 'instagram_basic,instagram_content_publish,pages_read_engagement,pages_show_list';

    window.FB.login((response: any) => {
      if (response.authResponse) {
        onSuccess(response.authResponse.accessToken);
      } else {
        onError('User cancelled login or did not fully authorize.');
      }
    }, { scope });
  };

  return (
    <button
      className={`btn btn-login btn-${platform}`}
      onClick={handleLogin}
      disabled={!isLoaded}
    >
      {isLoaded ? `Log in with ${platform === 'facebook' ? 'Facebook' : 'Instagram'}` : 'Loading SDK...'}
    </button>
  );
}
