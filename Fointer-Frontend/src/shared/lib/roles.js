export const ROLE_HIERARCHY = {
  user: 1,
  admin: 2,
};

export const hasMinRole = (userRole, minRole) => {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const minLevel = ROLE_HIERARCHY[minRole] ?? Infinity;
  return userLevel >= minLevel;
};

export const canAccessRoles = (userRole, allowedRoles = []) => {
  if (!userRole || !allowedRoles.length) return false;
  return allowedRoles.includes(userRole);
};

export const getDashboardPathForRole = (role) => {
  return role === "admin" ? "/admin" : "/";
};
