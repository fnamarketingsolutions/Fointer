import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

let unauthorizedHandler = null;

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';

    const isAuthProbe =
      url.includes('/auth/me') ||
      url.includes('/auth/login') ||
      url.includes('/auth/admin/login') ||
      url.includes('/auth/admin/google') ||
      url.includes('/auth/admin/facebook');

    if (status === 401 && !isAuthProbe && unauthorizedHandler) {
      unauthorizedHandler();
    }

    return Promise.reject(error);
  }
);

export default api;
