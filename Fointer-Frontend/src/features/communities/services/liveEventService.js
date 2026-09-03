import api from '../../../shared/services/http/client';

export const fetchLiveEvents = async (params = {}) => {
  const response = await api.get('/live-events', { params });
  return response.data;
};

export const fetchLiveEvent = async (id) => {
  const response = await api.get(`/live-events/${id}`);
  return response.data;
};

export const createLiveEvent = async (payload) => {
  const response = await api.post('/live-events', payload);
  return response.data;
};

export const endLiveEvent = async (id) => {
  const response = await api.post(`/live-events/${id}/end`);
  return response.data;
};

export const deleteLiveEvent = async (id) => {
  const response = await api.delete(`/live-events/${id}`);
  return response.data;
};

export const fetchLiveMessages = async (id, params = {}) => {
  const response = await api.get(`/live-events/${id}/messages`, { params });
  return response.data;
};

export const deleteLiveMessage = async (eventId, messageId) => {
  const response = await api.delete(
    `/live-events/${eventId}/messages/${messageId}`
  );
  return response.data;
};

export const fetchHostableCommunities = async () => {
  const response = await api.get('/live-events/hostable-communities');
  return response.data;
};
