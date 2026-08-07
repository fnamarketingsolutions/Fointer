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



// ——— Watch Groups ———

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
  const response = await api.post(`/watch-groups/${groupId}/join-requests`, payload);
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
  const response = await api.get(`/watch-groups/${groupId}/messages`, { params });
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
  const response = await api.delete(`/watch-groups/${groupId}/messages/${messageId}`);
  return response.data;
};

export const closeWatchGroup = async (groupId) => {
  const response = await api.delete(`/watch-groups/${groupId}`);
  return response.data;
};

export const removeWatchGroupMember = async (groupId, userId) => {
  const response = await api.delete(`/watch-groups/${groupId}/members/${userId}`);
  return response.data;
};
