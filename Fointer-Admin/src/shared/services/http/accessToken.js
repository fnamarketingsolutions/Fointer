/**
 * In-memory only — avoids persisting the admin JWT in sessionStorage where
 * XSS can exfiltrate it after the malicious script is gone.
 * Page refresh falls back to the httpOnly cookie (SameSite=None) when present.
 */
let memoryToken = '';

const LEGACY_STORAGE_KEY = 'fointer-admin-access-token';

try {
  sessionStorage.removeItem(LEGACY_STORAGE_KEY);
} catch {
  /* private mode / blocked storage */
}

export const getAccessToken = () => memoryToken || '';

export const setAccessToken = (token) => {
  memoryToken = token ? String(token) : '';
};

export const clearAccessToken = () => setAccessToken('');
