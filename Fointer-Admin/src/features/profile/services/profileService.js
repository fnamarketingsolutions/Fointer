import api from '../../../shared/services/http/client';

export const fetchMyProfile = async () => {
  const response = await api.get('/profile/me');
  return response.data;
};

export const updateMyProfile = async (payload) => {
  const response = await api.patch('/profile/me', payload);
  return response.data;
};

export const updateMyPassword = async (payload) => {
  const response = await api.patch('/profile/password', payload);
  return response.data;
};

export const fetchPublicProfile = async (username) => {
  const clean = String(username || '').trim().replace(/^@+/, '');
  const response = await api.get(`/users/${encodeURIComponent(clean)}`);
  return response.data;
};
