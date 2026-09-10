import api from "./http/client";

export const fetchPublicSiteContact = async () => {
  const response = await api.get("/site/contact");
  return response.data;
};
