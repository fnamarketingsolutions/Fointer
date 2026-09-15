import api from '../../../shared/services/http/client';

/** Admin-used community APIs only (member invite/join/mine helpers removed). */

export const fetchAllCommunities = async () => {
  const response = await api.get('/communities');
  return response.data;
};

export const updateCommunity = async (id, payload) => {
  const response = await api.patch(`/communities/${id}`, payload);
  return response.data;
};

export const deleteCommunity = async (id) => {
  const response = await api.delete(`/communities/${id}`);
  return response.data;
};

export const requestToJoin = async (id, payload = {}) => {
  const response = await api.post(`/communities/${id}/join-requests`, payload);
  return response.data;
};

export const joinPublicCommunity = async (id) => {
  const response = await api.post(`/communities/${id}/join`);
  return response.data;
};
