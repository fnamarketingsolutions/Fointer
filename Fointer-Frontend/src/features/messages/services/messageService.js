import api from '../../../shared/services/http/client';

export const fetchConversations = async () => {
  const response = await api.get('/conversations');
  return response.data;
};

export const createConversation = async (payload) => {
  const response = await api.post('/conversations', payload);
  return response.data;
};

export const fetchConversation = async (id) => {
  const response = await api.get(`/conversations/${id}`);
  return response.data;
};

export const fetchMessages = async (id, params = {}) => {
  const response = await api.get(`/conversations/${id}/messages`, { params });
  return response.data;
};

export const sendMessage = async (id, payload) => {
  const response = await api.post(`/conversations/${id}/messages`, payload);
  return response.data;
};

export const markConversationRead = async (id) => {
  const response = await api.patch(`/conversations/${id}/read`);
  return response.data;
};

export const deleteConversation = async (id) => {
  const response = await api.delete(`/conversations/${id}`);
  return response.data;
};

export const updateMessage = async (conversationId, messageId, payload) => {
  const response = await api.patch(
    `/conversations/${conversationId}/messages/${messageId}`,
    payload
  );
  return response.data;
};

export const deleteMessage = async (conversationId, messageId) => {
  const response = await api.delete(
    `/conversations/${conversationId}/messages/${messageId}`
  );
  return response.data;
};
