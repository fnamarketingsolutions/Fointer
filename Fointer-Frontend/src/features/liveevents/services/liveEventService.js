import api from '../../../shared/services/http/client';

export const fetchLiveEventCreateContext = async () => {
  const response = await api.get('/live-events/create-context');
  return response.data;
};

export const fetchLiveEvents = async (params = {}) => {
  const response = await api.get('/live-events', { params });
  return response.data;
};

export const createLiveEvent = async (payload) => {
  const response = await api.post('/live-events', payload);
  return response.data;
};

export const joinLiveEvent = async (eventId) => {
  const response = await api.post(`/live-events/${eventId}/join`);
  return response.data;
};

export const endLiveEvent = async (eventId) => {
  const response = await api.patch(`/live-events/${eventId}/end`);
  return response.data;
};

export const closeLiveEvent = async (eventId) => {
  const response = await api.delete(`/live-events/${eventId}`);
  return response.data;
};

export const fetchLiveEventChatMeta = async (eventId) => {
  const response = await api.get(`/live-events/${eventId}/chat-meta`);
  return response.data;
};

export const fetchLiveEventMessages = async (eventId, params = {}) => {
  const response = await api.get(`/live-events/${eventId}/messages`, {
    params,
  });
  return response.data;
};

export const createLiveEventMessage = async (eventId, payload) => {
  const response = await api.post(`/live-events/${eventId}/messages`, payload);
  return response.data;
};

export const updateLiveEventMessage = async (eventId, messageId, payload) => {
  const response = await api.patch(
    `/live-events/${eventId}/messages/${messageId}`,
    payload
  );
  return response.data;
};

export const deleteLiveEventMessage = async (eventId, messageId) => {
  const response = await api.delete(
    `/live-events/${eventId}/messages/${messageId}`
  );
  return response.data;
};

export const removeLiveEventMember = async (eventId, userId) => {
  const response = await api.delete(
    `/live-events/${eventId}/members/${userId}`
  );
  return response.data;
};
