import axios from 'axios';

const api = axios.create({
  // Prefer /api (Vite proxy) so ngrok HTTPS never hits localhost directly.
  baseURL: import.meta.env.VITE_BACKEND_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
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

    // Check if the URL is an authentication probe or OAuth callback endpoint
    const isAuthProbe =
      url.includes('/auth/me') ||
      url.includes('/auth/login') ||
      url.includes('/auth/signup') ||
      url.includes('/auth/google') ||
      url.includes('/auth/facebook') ||
      url.includes('/auth/callback') ||
      url.includes('/dashboard/');

    if (status === 401 && !isAuthProbe && unauthorizedHandler) {
      unauthorizedHandler();
    }

    return Promise.reject(error);
  }
);

export default api;