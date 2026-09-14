/** Sidebar / route tab ids used by Fointer-Admin (AdminDashboard NAV_ITEMS). */
export const ADMIN_TAB_IDS = [
  "users",
  "communities",
  "channels",
  "commentary",
  "watchgroups",
  "moderation",
  "marketplace",
  "analytics",
  "warnings",
  "support",
  "settings",
  "profile",
  "admins",
];

/** Tabs a super admin may grant to a limited admin (excludes Admin Management). */
export const ASSIGNABLE_ADMIN_TAB_IDS = ADMIN_TAB_IDS.filter(
  (id) => id !== "admins"
);

const normalizeRole = (role) =>
  String(role || "")
    .toLowerCase()
    .trim();

/**
 * Legacy admins (pre Phase 1) have no isSuperAdmin / adminTabs in DB.
 * Treat those as super so existing accounts keep full access until limited
 * admins are created explicitly with isSuperAdmin: false.
 */
export const resolveIsSuperAdmin = (user) => {
  if (normalizeRole(user?.role) !== "admin") return false;
  if (user?.isSuperAdmin === true) return true;
  if (user?.isSuperAdmin === false) return false;
  const tabs = Array.isArray(user?.adminTabs) ? user.adminTabs : [];
  return tabs.length === 0;
};

export const resolveAdminTabs = (user) => {
  if (normalizeRole(user?.role) !== "admin") return [];
  if (resolveIsSuperAdmin(user)) return [...ADMIN_TAB_IDS];
  const tabs = Array.isArray(user?.adminTabs) ? user.adminTabs : [];
  return tabs
    .map((t) => String(t || "").toLowerCase().trim())
    .filter((t) => ADMIN_TAB_IDS.includes(t));
};

export const canAccessAdminTab = (user, tabId) => {
  const tab = String(tabId || "")
    .toLowerCase()
    .trim();
  if (!tab) return false;
  if (normalizeRole(user?.role) !== "admin") return false;
  if (resolveIsSuperAdmin(user)) return true;
  // Profile is always available to any admin once logged in.
  if (tab === "profile") return true;
  return resolveAdminTabs(user).includes(tab);
};

/** Normalize + validate tabs for create/update. Returns { ok, tabs, message }. */
export const normalizeAssignableAdminTabs = (rawTabs) => {
  if (!Array.isArray(rawTabs)) {
    return {
      ok: false,
      tabs: [],
      message: "adminTabs must be an array of tab ids.",
    };
  }

  const seen = new Set();
  const tabs = [];
  for (const item of rawTabs) {
    const tab = String(item || "")
      .toLowerCase()
      .trim();
    if (!tab || seen.has(tab)) continue;
    if (tab === "admins") {
      return {
        ok: false,
        tabs: [],
        message: "Cannot grant Admin Management tab to a limited admin.",
      };
    }
    if (!ASSIGNABLE_ADMIN_TAB_IDS.includes(tab)) {
      return {
        ok: false,
        tabs: [],
        message: `Invalid admin tab: ${tab}`,
      };
    }
    seen.add(tab);
    tabs.push(tab);
  }

  if (!tabs.length) {
    return {
      ok: false,
      tabs: [],
      message: "Select at least one admin tab.",
    };
  }

  return { ok: true, tabs, message: null };
};

/** Fields to attach on login /me responses for the admin SPA. */
export const getAdminAccessPayload = (user) => {
  const isSuperAdmin = resolveIsSuperAdmin(user);
  return {
    isSuperAdmin,
    adminTabs: isSuperAdmin ? [...ADMIN_TAB_IDS] : resolveAdminTabs(user),
  };
};

/**
 * Admin fan-out notification type → required tab.
 * Must match Admin UI ownership + API gates (single source of truth):
 * - content_report → Reporting & Analytics (`/analytics`, `/admin/reports`)
 * - channel_request → Support
 * - user_warning → Warnings
 * Unmapped types → super only.
 */
export const ADMIN_NOTIFICATION_TAB_BY_TYPE = {
  content_report: "analytics",
  channel_request: "support",
  user_warning: "warnings",
};

export const tabForAdminNotificationType = (type) => {
  const key = String(type || "")
    .toLowerCase()
    .trim();
  return ADMIN_NOTIFICATION_TAB_BY_TYPE[key] || null;
};

export const adminCanReceiveNotificationType = (user, type) => {
  if (normalizeRole(user?.role) !== "admin") return false;
  if (resolveIsSuperAdmin(user)) return true;
  const tab = tabForAdminNotificationType(type);
  if (!tab) return false;
  return canAccessAdminTab(user, tab);
};

/** Subset of admin notification types this admin may see / receive. */
export const allowedAdminNotificationTypes = (user, allTypes = []) => {
  if (normalizeRole(user?.role) !== "admin") return [];
  if (resolveIsSuperAdmin(user)) return [...allTypes];
  return allTypes.filter((type) => adminCanReceiveNotificationType(user, type));
};

/**
 * Limited admins only get elevated member-API powers for tabs they hold.
 * Super admins keep full platform powers.
 */
export const hasAdminTabPower = (user, ...tabIds) => {
  if (normalizeRole(user?.role) !== "admin") return false;
  if (resolveIsSuperAdmin(user)) return true;
  return tabIds.some((tabId) => canAccessAdminTab(user, tabId));
};

export const hasCommunitiesAdminPower = (user) =>
  hasAdminTabPower(user, "communities");

export const hasModerationAdminPower = (user) =>
  hasAdminTabPower(user, "moderation");

/** Communities + Content Moderation (view/delete private community content). */
export const hasContentAdminPower = (user) =>
  hasAdminTabPower(user, "communities", "moderation");

export const hasMarketplaceAdminPower = (user) =>
  hasAdminTabPower(user, "marketplace");

export const hasWatchGroupsAdminPower = (user) =>
  hasAdminTabPower(user, "watchgroups");

export const hasLiveEventsAdminPower = (user) =>
  hasAdminTabPower(user, "commentary");

export const hasUsersAdminPower = (user) => hasAdminTabPower(user, "users");
