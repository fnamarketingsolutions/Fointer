import api from '../shared/services/http/client';

export const fetchUserSupportCategories = async () => {
  const response = await api.get('/user-support/categories');
  return response.data;
};

export const submitUserSupportRequest = async (payload) => {
  const response = await api.post('/user-support/requests', payload);
  return response.data;
};
