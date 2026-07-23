import api from './axios';

export const fetchOverview = async () => {
  const response = await api.get('/dashboard/overview');
  return response.data;
};

export const fetchUsers = async () => {
  const response = await api.get('/admin/users');
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
