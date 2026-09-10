import api from '../../../shared/services/http/client';

export const adminLogin = async (data) => {
  const response = await api.post('/auth/admin/login', data);
  return response.data;
};

export const adminGoogleAuth = async (token) => {
  const response = await api.post('/auth/admin/google', { token });
  return response.data;
};

export const adminFacebookAuth = async (accessToken) => {
  const response = await api.post('/auth/admin/facebook', { accessToken });
  return response.data;
};

export const getMe = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const logoutUser = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
};
