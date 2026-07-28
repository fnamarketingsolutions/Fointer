const FB_SCRIPT_ID = 'facebook-jssdk';
const FB_VERSION = 'v19.0';

let initPromise = null;

/**
 * Load and initialize the Facebook JS SDK once per page.
 * Does not call FB.setAccessToken — tokens are passed only to our API.
 */
export function ensureFacebookSdk() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Facebook SDK requires a browser environment.'));
  }

  if (window.FB && window.__fbSdkReady) {
    return Promise.resolve(window.FB);
  }

  if (initPromise) return initPromise;

  const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
  if (!appId) {
    return Promise.reject(new Error('VITE_FACEBOOK_APP_ID is not configured.'));
  }

  initPromise = new Promise((resolve, reject) => {
    const finishInit = () => {
      try {
        window.FB.init({
          appId,
          cookie: false,
          xfbml: false,
          version: FB_VERSION,
        });
        window.__fbSdkReady = true;
        resolve(window.FB);
      } catch (err) {
        initPromise = null;
        reject(err);
      }
    };

    window.fbAsyncInit = finishInit;

    if (document.getElementById(FB_SCRIPT_ID)) {
      if (window.FB) {
        finishInit();
      }
      return;
    }

    const script = document.createElement('script');
    script.id = FB_SCRIPT_ID;
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      initPromise = null;
      reject(new Error('Facebook SDK failed to load. It may be blocked by an ad blocker.'));
    };
    document.body.appendChild(script);
  });

  return initPromise;
}

/**
 * Open Facebook login dialog and return the short-lived access token.
 * Resolves null when the user cancels or closes the popup.
 */
export async function loginWithFacebook(scope = 'public_profile,email') {
  const FB = await ensureFacebookSdk();

  return new Promise((resolve, reject) => {
    try {
      FB.login(
        (response) => {
          const accessToken = response?.authResponse?.accessToken ?? null;
          resolve(accessToken);
        },
        { scope }
      );
    } catch (err) {
      reject(err);
    }
  });
}
