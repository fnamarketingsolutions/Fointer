import api from '../../../shared/services/http/client';

export const fetchWatchGroups = async (params = {}) => {
  const response = await api.get('/watch-groups', { params });
  return response.data;
};

export const fetchWatchGroup = async (id) => {
  const response = await api.get(`/watch-groups/${id}`);
  return response.data;
};

export const createWatchGroup = async (payload) => {
  const response = await api.post('/watch-groups', payload);
  return response.data;
};

export const joinWatchGroup = async (id) => {
  const response = await api.post(`/watch-groups/${id}/join`);
  return response.data;
};

export const leaveWatchGroup = async (id) => {
  const response = await api.post(`/watch-groups/${id}/leave`);
  return response.data;
};

export const deleteWatchGroup = async (id) => {
  const response = await api.delete(`/watch-groups/${id}`);
  return response.data;
};

export const fetchWatchParticipants = async (id) => {
  const response = await api.get(`/watch-groups/${id}/participants`);
  return response.data;
};

export const addWatchParticipant = async (id, payload) => {
  const response = await api.post(`/watch-groups/${id}/participants`, payload);
  return response.data;
};

export const removeWatchParticipant = async (id, memberId) => {
  const response = await api.delete(
    `/watch-groups/${id}/participants/${memberId}`
  );
  return response.data;
};

export const setWatchParticipantRole = async (id, memberId, role) => {
  const response = await api.patch(
    `/watch-groups/${id}/participants/${memberId}/role`,
    { role }
  );
  return response.data;
};

export const fetchWatchMessages = async (id, params = {}) => {
  const response = await api.get(`/watch-groups/${id}/messages`, { params });
  return response.data;
};

export const deleteWatchMessage = async (groupId, messageId) => {
  const response = await api.delete(
    `/watch-groups/${groupId}/messages/${messageId}`
  );
  return response.data;
};
