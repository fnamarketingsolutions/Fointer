import api from './http/client';

export const uploadMedia = async (file, folder = 'fointer/posts') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  const response = await api.post('/uploads', formData);
  return response.data;
};
