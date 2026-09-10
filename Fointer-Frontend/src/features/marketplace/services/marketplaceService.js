import api from '../../../shared/services/http/client';

export const fetchListings = async (params = {}) => {
  const response = await api.get('/marketplace', { params });
  return response.data;
};

export const fetchMyListings = async (params = {}) => {
  const response = await api.get('/marketplace/mine', { params });
  return response.data;
};

export const fetchListing = async (id) => {
  const response = await api.get(`/marketplace/${id}`);
  return response.data;
};

export const createListing = async (payload) => {
  const response = await api.post('/marketplace', payload);
  return response.data;
};

export const updateListing = async (id, payload) => {
  const response = await api.patch(`/marketplace/${id}`, payload);
  return response.data;
};

export const markListingSold = async (id) => {
  const response = await api.post(`/marketplace/${id}/sold`);
  return response.data;
};

export const deleteListing = async (id) => {
  const response = await api.delete(`/marketplace/${id}`);
  return response.data;
};

export const contactSeller = async (id, payload) => {
  const response = await api.post(`/marketplace/${id}/contact`, payload);
  return response.data;
};
