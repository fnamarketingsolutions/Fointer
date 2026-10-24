import api from "../../../shared/services/http/client";

export const fetchPublicStores = async (params = {}) => {
  const response = await api.get("/stores", { params });
  return response.data;
};

export const followStore = async (id) => {
  const response = await api.post(`/stores/${id}/follow`);
  return response.data;
};

export const unfollowStore = async (id) => {
  const response = await api.delete(`/stores/${id}/follow`);
  return response.data;
};

export const messageStore = async (id, message) => {
  const response = await api.post(`/stores/${id}/message`, { message });
  return response.data;
};

export const fetchMyStores = async () => {
  const response = await api.get("/stores/mine");
  return response.data;
};

export const fetchStoreBySlug = async (slug) => {
  const response = await api.get(`/stores/slug/${encodeURIComponent(slug)}`);
  return response.data;
};

export const fetchStore = async (id) => {
  const response = await api.get(`/stores/${id}`);
  return response.data;
};

export const createStore = async (payload) => {
  const response = await api.post("/stores", payload);
  return response.data;
};

export const updateStore = async (id, payload) => {
  const response = await api.patch(`/stores/${id}`, payload);
  return response.data;
};

export const deleteStore = async (id) => {
  const response = await api.delete(`/stores/${id}`);
  return response.data;
};

export const createStoreCategory = async (storeId, name) => {
  const response = await api.post(`/stores/${storeId}/categories`, { name });
  return response.data;
};

export const deleteStoreCategory = async (storeId, categoryId) => {
  const response = await api.delete(
    `/stores/${storeId}/categories/${categoryId}`
  );
  return response.data;
};
