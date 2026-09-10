import api from '../../../shared/services/http/client';

const cleanUsername = (username) =>
  String(username || '')
    .trim()
    .replace(/^@+/, '');

export const fetchFollowers = async (username, params = {}) => {
  const response = await api.get(
    `/users/${encodeURIComponent(cleanUsername(username))}/followers`,
    { params }
  );
  return response.data;
};

export const fetchFollowing = async (username, params = {}) => {
  const response = await api.get(
    `/users/${encodeURIComponent(cleanUsername(username))}/following`,
    { params }
  );
  return response.data;
};
