import api from '../../../shared/services/http/client';

export const fetchMyReferrals = async ({ limit, cursor } = {}) => {
  const params = {};
  if (limit) params.limit = limit;
  if (cursor) params.cursor = cursor;
  const response = await api.get('/referrals/me', { params });
  return response.data;
};

export const fetchMyInviteLink = async () => {
  const response = await api.get('/referrals/me/link');
  return response.data;
};