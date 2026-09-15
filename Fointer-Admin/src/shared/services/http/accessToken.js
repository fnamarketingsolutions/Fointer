const TOKEN_KEY = 'fointer-admin-access-token';

export const getAccessToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

export const setAccessToken = (token) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, String(token));
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode / blocked storage */
  }
};

export const clearAccessToken = () => setAccessToken('');
