import api from '../../../shared/services/http/client';

export const fetchActiveBanners = async () => {
  const response = await api.get('/banners/active');
  return response.data;
};
