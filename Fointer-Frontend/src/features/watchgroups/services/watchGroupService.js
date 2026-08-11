import api from '../../../shared/services/http/client';

export const fetchWatchGroupCreateContext = async () => {
  const response = await api.get('/watch-groups/create-context');
  return response.data;
};

export const fetchWatchGroups = async (params = {}) => {
  const response = await api.get('/watch-groups', { params });
  return response.data;
};

export const createWatchGroup = async (payload) => {
  const response = await api.post('/watch-groups', payload);
  return response.data;
};

export const joinWatchGroup = async (groupId) => {
  const response = await api.post(`/watch-groups/${groupId}/join`);
  return response.data;
};

export const requestJoinWatchGroup = async (groupId, payload = {}) => {
  const response = await api.post(
    `/watch-groups/${groupId}/join-requests`,
    payload
  );
  return response.data;
};

export const fetchWatchGroupJoinRequests = async (groupId, params = {}) => {
  const response = await api.get(`/watch-groups/${groupId}/join-requests`, {
    params,
  });
  return response.data;
};

export const approveWatchGroupJoinRequest = async (groupId, requestId) => {
  const response = await api.post(
    `/watch-groups/${groupId}/join-requests/${requestId}/approve`
  );
  return response.data;
};

export const denyWatchGroupJoinRequest = async (groupId, requestId) => {
  const response = await api.post(
    `/watch-groups/${groupId}/join-requests/${requestId}/deny`
  );
  return response.data;
};

export const fetchWatchGroupChatMeta = async (groupId) => {
  const response = await api.get(`/watch-groups/${groupId}/chat-meta`);
  return response.data;
};

export const fetchWatchGroupMessages = async (groupId, params = {}) => {
  const response = await api.get(`/watch-groups/${groupId}/messages`, {
    params,
  });
  return response.data;
};

export const createWatchGroupMessage = async (groupId, payload) => {
  const response = await api.post(`/watch-groups/${groupId}/messages`, payload);
  return response.data;
};

export const updateWatchGroupMessage = async (groupId, messageId, payload) => {
  const response = await api.patch(
    `/watch-groups/${groupId}/messages/${messageId}`,
    payload
  );
  return response.data;
};

export const deleteWatchGroupMessage = async (groupId, messageId) => {
  const response = await api.delete(
    `/watch-groups/${groupId}/messages/${messageId}`
  );
  return response.data;
};

export const closeWatchGroup = async (groupId) => {
  const response = await api.delete(`/watch-groups/${groupId}`);
  return response.data;
};

export const setWatchGroupPaused = async (groupId, paused) => {
  const response = await api.patch(`/watch-groups/${groupId}/pause`, {
    paused,
  });
  return response.data;
};

export const removeWatchGroupMember = async (groupId, userId) => {
  const response = await api.delete(
    `/watch-groups/${groupId}/members/${userId}`
  );
  return response.data;
};
