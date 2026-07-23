import api from './axios';

export const createCommunity = async (payload) => {
  const response = await api.post('/communities', payload);
  return response.data;
};

export const fetchMyCommunities = async () => {
  const response = await api.get('/communities/mine');
  return response.data;
};

export const fetchAllCommunities = async () => {
  const response = await api.get('/communities');
  return response.data;
};

export const fetchCommunity = async (id) => {
  const response = await api.get(`/communities/${id}`);
  return response.data;
};

export const fetchCommunityManage = async (id) => {
  const response = await api.get(`/communities/${id}/manage`);
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

export const fetchJoinRequests = async (id, status = 'pending') => {
  const response = await api.get(`/communities/${id}/join-requests`, {
    params: { status },
  });
  return response.data;
};

export const approveJoinRequest = async (communityId, requestId) => {
  const response = await api.post(
    `/communities/${communityId}/join-requests/${requestId}/approve`
  );
  return response.data;
};

export const denyJoinRequest = async (communityId, requestId) => {
  const response = await api.post(
    `/communities/${communityId}/join-requests/${requestId}/deny`
  );
  return response.data;
};
