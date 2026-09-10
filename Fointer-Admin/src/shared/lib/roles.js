/** Must stay aligned with Fointer-backend/utils/adminAccess.js ADMIN_TAB_IDS */
export const ADMIN_TAB_IDS = [
  'users',
  'communities',
  'channels',
  'commentary',
  'watchgroups',
  'moderation',
  'marketplace',
  'analytics',
  'warnings',
  'support',
  'settings',
  'profile',
  'admins',
];

/** Tabs that can be granted to limited admins (excludes Admin Management). */
export const ASSIGNABLE_ADMIN_TAB_IDS = ADMIN_TAB_IDS.filter(
  (id) => id !== 'admins'
);

export const ADMIN_TAB_LABELS = {
  users: 'User Management',
  communities: 'Community Management',
  channels: 'Channels Management',
  commentary: 'Live Events Management',
  watchgroups: 'Watch Groups Management',
  moderation: 'Content Moderation',
  marketplace: 'Marketplace',
  analytics: 'Reporting & Analytics',
  warnings: 'Warnings',
  support: 'Support Tools',
  settings: 'System Settings',
  profile: 'Profile',
  admins: 'Admin Management',
};

export const isAdminUser = (user) =>
  String(user?.role || '')
    .toLowerCase()
    .trim() === 'admin';

/**
 * Legacy admins (no isSuperAdmin / empty adminTabs) keep full access.
 * Limited admins are created with isSuperAdmin: false and a non-empty adminTabs list.
 */
export const isSuperAdminUser = (user) => {
  if (!isAdminUser(user)) return false;
  if (user?.isSuperAdmin === true) return true;
  if (user?.isSuperAdmin === false) return false;
  const tabs = Array.isArray(user?.adminTabs) ? user.adminTabs : [];
  return tabs.length === 0;
};

export const getAdminTabs = (user) => {
  if (!isAdminUser(user)) return [];
  if (isSuperAdminUser(user)) return [...ADMIN_TAB_IDS];
  const tabs = Array.isArray(user?.adminTabs) ? user.adminTabs : [];
  return tabs
    .map((t) => String(t || '').toLowerCase().trim())
    .filter((t) => ADMIN_TAB_IDS.includes(t));
};

export const canAccessAdminTab = (user, tabId) => {
  const tab = String(tabId || '')
    .toLowerCase()
    .trim();
  if (!tab || !isAdminUser(user)) return false;
  if (isSuperAdminUser(user)) return true;
  if (tab === 'profile') return true;
  return getAdminTabs(user).includes(tab);
};