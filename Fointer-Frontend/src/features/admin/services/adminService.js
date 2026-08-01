import api from '../../../shared/services/http/client';

export const fetchOverview = async () => {
  const response = await api.get('/dashboard/overview');
  return response.data;
};

export const fetchUsers = async (params = {}) => {
  const response = await api.get('/admin/users', { params });
  return response.data;
};

export const updateUserStatus = async (userId, status) => {
  const response = await api.patch(`/admin/users/${userId}/status`, {
    status,
  });
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
