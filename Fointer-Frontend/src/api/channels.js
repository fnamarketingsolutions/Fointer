import api from '../shared/services/http/client';

export const fetchChannels = async (params = {}) => {
  const response = await api.get('/channels', { params });
  return response.data;
};

export const fetchSubchannels = async (params = {}) => {
  const response = await api.get('/subchannels', { params });
  return response.data;
};

export const createSupportTicket = async (payload) => {
  const response = await api.post('/support', payload);
  return response.data;
};

export const fetchMySupportTickets = async () => {
  const response = await api.get('/support/mine');
  return response.data;
};
