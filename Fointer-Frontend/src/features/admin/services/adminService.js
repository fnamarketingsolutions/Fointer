import api from '../../../shared/services/http/client';

export const fetchOverview = async () => {
  const response = await api.get('/dashboard/overview');
  return response.data;
};

export const fetchUsers = async (params = {}) => {
  const response = await api.get('/admin/users', { params });
  return response.data;
};

export const updateUser = async (userId, payload) => {
  const response = await api.patch(`/admin/users/${userId}`, payload);
  return response.data;
};

export const deleteUser = async (userId) => {
  const response = await api.delete(`/admin/users/${userId}`);
  return response.data;
};

export const resetUserPassword = async (userId, password) => {
  const response = await api.post(`/admin/users/${userId}/reset-password`, {
    password,
  });
  return response.data;
};

export const fetchUserActivity = async (userId) => {
  const response = await api.get(`/admin/users/${userId}/activity`);
  return response.data;
};

export const fetchAdminUserDetail = async (userId) => {
  const response = await api.get(`/admin/users/${userId}/detail`);
  return response.data;
};

export const fetchAdminCommunityDetail = async (communityId) => {
  const response = await api.get(`/admin/communities/${communityId}/detail`);
  return response.data;
};

export const fetchSystemSettings = async () => {
  const response = await api.get('/admin/settings');
  return response.data;
};

export const updateSystemSettings = async (payload) => {
  const response = await api.patch('/admin/settings', payload);
  return response.data;
};
