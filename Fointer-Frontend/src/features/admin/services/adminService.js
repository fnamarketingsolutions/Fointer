import api from '../../../shared/services/http/client';

export const fetchOverview = async () => {
  const response = await api.get('/dashboard/overview');
  return response.data;
};

export const fetchUsers = async (params = {}) => {
  const response = await api.get('/admin/users', { params });
  return response.data;
};

export const updateUserStatus = async (userId, status) => {
  const response = await api.patch(`/admin/users/${userId}/status`, {
    status,
  });
  return response.data;
};

export const fetchAdminUserDetail = async (userId) => {
  const response = await api.get(`/admin/users/${userId}/detail`);
  return response.data;
};

export const fetchAdminCommunityDetail = async (communityId) => {
  const response = await api.get(`/admin/communities/${communityId}/detail`);
  return response.data;
};

export const fetchSystemSettings = async () => {
  const response = await api.get('/admin/settings');
  return response.data;
};

export const updateSystemSettings = async (payload) => {
  const response = await api.patch('/admin/settings', payload);
  return response.data;
};

export const fetchAdminChannels = async (params = {}) => {
  const response = await api.get('/admin/channels', { params });
  return response.data;
};

export const createAdminChannel = async (payload) => {
  const response = await api.post('/admin/channels', payload);
  return response.data;
};

export const fetchAdminSubchannels = async (params = {}) => {
  const response = await api.get('/admin/subchannels', { params });
  return response.data;
};

export const createAdminSubchannel = async (payload) => {
  const response = await api.post('/admin/subchannels', payload);
  return response.data;
};

export const fetchAdminSupportTickets = async (params = {}) => {
  const response = await api.get('/admin/support', { params });
  return response.data;
};

export const updateAdminSupportTicketStatus = async (ticketId, status) => {
  const response = await api.patch(`/admin/support/${ticketId}/status`, {
    status,
  });
  return response.data;
};

export const fetchAdminLiveEvents = async (params = {}) => {
  const response = await api.get('/admin/live-events', { params });
  return response.data;
};

export const fetchAdminLiveEvent = async (eventId) => {
  const response = await api.get(`/admin/live-events/${eventId}`);
  return response.data;
};

export const endAdminLiveEvent = async (eventId) => {
  const response = await api.post(`/admin/live-events/${eventId}/end`);
  return response.data;
};

export const deleteAdminLiveEvent = async (eventId) => {
  const response = await api.delete(`/admin/live-events/${eventId}`);
  return response.data;
};

export const fetchAdminLiveMessages = async (eventId, params = {}) => {
  const response = await api.get(`/admin/live-events/${eventId}/messages`, {
    params,
  });
  return response.data;
};

export const deleteAdminLiveMessage = async (eventId, messageId) => {
  const response = await api.delete(
    `/admin/live-events/${eventId}/messages/${messageId}`
  );
  return response.data;
};

export const fetchAdminWatchGroups = async (params = {}) => {
  const response = await api.get('/admin/watch-groups', { params });
  return response.data;
};

export const deleteAdminWatchGroup = async (groupId) => {
  const response = await api.delete(`/admin/watch-groups/${groupId}`);
  return response.data;
};

export const fetchAdminWatchMessages = async (groupId, params = {}) => {
  const response = await api.get(`/admin/watch-groups/${groupId}/messages`, {
    params,
  });
  return response.data;
};

export const deleteAdminWatchMessage = async (groupId, messageId) => {
  const response = await api.delete(
    `/admin/watch-groups/${groupId}/messages/${messageId}`
  );
  return response.data;
};

export const fetchAdminWatchParticipants = async (groupId) => {
  const response = await api.get(`/admin/watch-groups/${groupId}/participants`);
  return response.data;
};

export const removeAdminWatchParticipant = async (groupId, memberId) => {
  const response = await api.delete(
    `/admin/watch-groups/${groupId}/participants/${memberId}`
  );
  return response.data;
};

export const fetchAdminModerationPosts = async (params = {}) => {
  const response = await api.get('/admin/moderation/posts', { params });
  return response.data;
};

export const deleteAdminModerationPost = async (postId) => {
  const response = await api.delete(`/admin/moderation/posts/${postId}`);
  return response.data;
};

export const fetchAdminModerationComments = async (params = {}) => {
  const response = await api.get('/admin/moderation/comments', { params });
  return response.data;
};

export const deleteAdminModerationComment = async (commentId) => {
  const response = await api.delete(`/admin/moderation/comments/${commentId}`);
  return response.data;
};

export const fetchAdminReports = async (params = {}) => {
  const response = await api.get('/admin/reports', { params });
  return response.data;
};

export const updateAdminReport = async (reportId, payload) => {
  const response = await api.patch(`/admin/reports/${reportId}`, payload);
  return response.data;
};

export const fetchAdminAnalytics = async () => {
  const response = await api.get('/admin/analytics');
  return response.data;
};
