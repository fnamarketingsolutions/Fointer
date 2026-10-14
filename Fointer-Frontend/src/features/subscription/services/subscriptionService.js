import api from '../../../shared/services/http/client';

export const fetchSubscriptionPlans = async () => {
  const { data } = await api.get('/subscriptions/plans');
  return data;
};

export const fetchMyEntitlement = async () => {
  const { data } = await api.get('/subscriptions/entitlement');
  return data;
};

export const fetchAdsConfig = async () => {
  const { data } = await api.get('/ads/config');
  return data;
};

export const startSubscriptionCheckout = async (planCode = 'ADFREE_MONTHLY') => {
  const { data } = await api.post('/subscriptions/checkout', { planCode });
  return data;
};

export const verifySubscriptionPayment = async (payload) => {
  const { data } = await api.post('/subscriptions/verify', payload);
  return data;
};

export const fetchSubscriptionManage = async () => {
  const { data } = await api.get('/subscriptions/manage');
  return data;
};

export const cancelSubscription = async (reason = 'user_requested') => {
  const { data } = await api.post('/subscriptions/cancel', { reason });
  return data;
};

export const restoreSubscriptionPurchases = async (payload) => {
  const { data } = await api.post('/subscriptions/restore', payload);
  return data;
};

export const verifyGooglePlayPurchase = async (payload) => {
  const { data } = await api.post('/subscriptions/google/verify', payload);
  return data;
};

export const verifyApplePurchase = async (payload) => {
  const { data } = await api.post('/subscriptions/apple/verify', payload);
  return data;
};
