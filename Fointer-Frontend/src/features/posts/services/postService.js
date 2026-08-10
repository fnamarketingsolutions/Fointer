import api from '../../../shared/services/http/client';

export const fetchPosts = async (params = {}) => {
  const response = await api.get('/posts', { params });
  return response.data;
};

export const fetchPost = async (id) => {
  const response = await api.get(`/posts/${id}`);
  return response.data;
};

export const fetchPublicPosts = async (params = {}) => {
  const response = await api.get('/posts/public', { params });
  return response.data;
};

export const fetchPublicPost = async (id) => {
  const response = await api.get(`/posts/public/${id}`);
  return response.data;
};

export const createPost = async (payload) => {
  const response = await api.post('/posts', payload);
  return response.data;
};

export const updatePost = async (id, payload) => {
  const response = await api.patch(`/posts/${id}`, payload);
  return response.data;
};

export const deletePost = async (id) => {
  const response = await api.delete(`/posts/${id}`);
  return response.data;
};

export const fetchComments = async (postId) => {
  const response = await api.get(`/posts/${postId}/comments`);
  return response.data;
};

export const createComment = async (postId, payload) => {
  const response = await api.post(`/posts/${postId}/comments`, payload);
  return response.data;
};

export const updateComment = async (commentId, payload) => {
  const response = await api.patch(`/posts/comments/${commentId}`, payload);
  return response.data;
};

export const deleteComment = async (commentId) => {
  const response = await api.delete(`/posts/comments/${commentId}`);
  return response.data;
};

export const togglePostLike = async (postId) => {
  const response = await api.post(`/posts/${postId}/like`);
  return response.data;
};

export const toggleCommentLike = async (commentId) => {
  const response = await api.post(`/posts/comments/${commentId}/like`);
  return response.data;
};

export const fetchMyComments = async (params = {}) => {
  const response = await api.get('/posts/activity/comments', { params });
  return response.data;
};

export const fetchMyLikedPosts = async (params = {}) => {
  const response = await api.get('/posts/activity/likes', { params });
  return response.data;
};

export { uploadMedia } from '../../../shared/services/uploadService';
