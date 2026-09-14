import api from '../../../shared/services/http/client';

const cleanUsername = (username) =>
  String(username || '')
    .trim()
    .replace(/^@+/, '');

export const followUser = async (username) => {
  const response = await api.post(
    `/users/${encodeURIComponent(cleanUsername(username))}/follow`
  );
  return response.data;
};

export const unfollowUser = async (username) => {
  const response = await api.delete(
    `/users/${encodeURIComponent(cleanUsername(username))}/follow`
  );
  return response.data;
};

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
