export const canAccessRoles = (userRole, allowedRoles = []) => {
  if (!userRole || !allowedRoles.length) return false;
  return allowedRoles.includes(userRole);
};

export const getDashboardPathForRole = (role) => {
  return role === "admin" ? "/admin" : "/feed";
};
