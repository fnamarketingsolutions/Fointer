import api from './axios';

export const sigupUser = async (data) => {
  const response = await api.post(`/auth/signup`, data);
  return response.data;
};

export const verifyEmailOtp = async (email, otp) => {
  const response = await api.post(`/auth/verify-email-otp`, { email, otp });
  return response.data;
};

export const resendVerificationEmail = async (email) => {
  const response = await api.post(`/auth/resend-verification`, { email });
  return response.data;
};

export const loginUser = async (data) => {
  const response = await api.post(`/auth/login`, data);
  return response.data;
};

export const googleAuth = async (token) => {
  const response = await api.post(`/auth/google`, { token });
  return response.data;
};

export const facebookAuth = async (accessToken) => {
  const response = await api.post(`/auth/facebook`, { accessToken });
  return response.data;
};

export const getMe = async () => {
  const response = await api.get(`/auth/me`);
  return response.data;
};

export const logoutUser = async () => {
  const response = await api.post(`/auth/logout`);
  return response.data;
};
