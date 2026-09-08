import api from '../../../shared/services/http/client';

export const fetchNotifications = async (params = {}) => {
  const response = await api.get('/notifications', { params });
  return response.data;
};

export const fetchUnreadCount = async () => {
  const response = await api.get('/notifications/unread-count');
  return response.data;
};

export const markNotificationRead = async (id) => {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data;
};

export const markNotificationUnread = async (id) => {
  const response = await api.patch(`/notifications/${id}/unread`);
  return response.data;
};

export const markAllNotificationsRead = async () => {
  const response = await api.post('/notifications/read-all');
  return response.data;
};

export const deleteNotification = async (id) => {
  const response = await api.delete(`/notifications/${id}`);
  return response.data;
};
