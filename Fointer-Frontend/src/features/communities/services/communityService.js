import api from '../../../shared/services/http/client';

export const createCommunity = async (payload) => {
  const response = await api.post('/communities', payload);
  return response.data;
};

export const fetchMyCommunities = async (params = {}) => {
  const response = await api.get('/communities/mine', { params });
  return response.data;
};

export const fetchJoinedCommunities = async () => {
  const response = await api.get('/communities/joined');
  return response.data;
};

export const fetchDiscoverCommunities = async () => {
  const response = await api.get('/communities/discover');
  return response.data;
};

export const fetchBrowsableCommunities = async (params = {}) => {
  const response = await api.get('/communities/browse', { params });
  return response.data;
};

export const fetchBrowsableCommunity = async (id) => {
  const response = await api.get(`/communities/browse/${id}`);
  return response.data;
};

export const fetchBrowsableCommunityMembers = async (id) => {
  const response = await api.get(`/communities/browse/${id}/members`);
  return response.data;
};

export const fetchMyJoinRequests = async () => {
  const response = await api.get('/communities/join-requests/mine');
  return response.data;
};

export const fetchMyInvites = async () => {
  const response = await api.get('/communities/invites/mine');
  return response.data;
};

export const inviteToCommunity = async (id, payload = {}) => {
  const response = await api.post(`/communities/${id}/invites`, payload);
  return response.data;
};

export const lookupInviteUser = async (communityId, username) => {
  const response = await api.get(`/communities/${communityId}/invite-user/lookup`, {
    params: { username },
  });
  return response.data;
};

export const inviteUserToCommunity = async (communityId, payload = {}) => {
  const response = await api.post(
    `/communities/${communityId}/invite-user`,
    payload
  );
  return response.data;
};

export const fetchCommunityInvites = async (id, status = 'pending') => {
  const response = await api.get(`/communities/${id}/invites`, {
    params: { status },
  });
  return response.data;
};

export const acceptInvite = async (inviteId) => {
  const response = await api.post(`/communities/invites/${inviteId}/accept`);
  return response.data;
};

export const declineInvite = async (inviteId) => {
  const response = await api.post(`/communities/invites/${inviteId}/decline`);
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

export const fetchCommunityMembers = async (id, status = 'active') => {
  const response = await api.get(`/communities/${id}/members`, {
    params: { status },
  });
  return response.data;
};

export const assignModerator = async (id, payload) => {
  const response = await api.post(`/communities/${id}/moderators`, payload);
  return response.data;
};

export const fetchModerators = async (communityId) => {
  const response = await api.get(`/communities/${communityId}/moderators`);
  return response.data;
};

export const revokeModerator = async (communityId, userId) => {
  const response = await api.delete(`/communities/${communityId}/moderators/${userId}`);
  return response.data;
};

export const removeCommunityMember = async (communityId, memberId, payload = {}) => {
  const response = await api.delete(`/communities/${communityId}/members/${memberId}`, {
    data: payload,
  });
  return response.data;
};

export const banCommunityMember = async (communityId, memberId) => {
  const response = await api.post(`/communities/${communityId}/members/${memberId}/ban`);
  return response.data;
};

export const unbanCommunityMember = async (communityId, memberId) => {
  const response = await api.post(`/communities/${communityId}/members/${memberId}/unban`);
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

