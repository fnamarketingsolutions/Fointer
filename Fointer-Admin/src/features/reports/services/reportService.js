import api from '../../../shared/services/http/client';

export const fetchReportReasons = async () => {
  const response = await api.get('/reports/reasons');
  return response.data;
};

export const createReport = async (payload) => {
  const response = await api.post('/reports', payload);
  return response.data;
};
