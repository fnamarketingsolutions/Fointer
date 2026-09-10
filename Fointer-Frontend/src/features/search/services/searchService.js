import api from "../../../shared/services/http/client";

export const globalSearch = async (params = {}) => {
  const response = await api.get("/search", { params });
  return response.data;
};
