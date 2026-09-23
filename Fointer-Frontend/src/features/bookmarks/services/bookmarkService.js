import api from '../../../shared/services/http/client';
export const toggleBookmark = async ({ targetType, targetId }) => {
  const response = await api.post('/bookmarks/toggle', {
    targetType,
    targetId,
  });
  return response.data;
};

export const fetchMyBookmarks = async (params = {}) => {
  const response = await api.get('/bookmarks', { params });
  return response.data;
};
