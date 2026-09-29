/** Display payload when a referenced user no longer exists. */
export const DELETED_USER_DISPLAY = {
  id: null,
  username: "",
  name: "Deleted User",
  avatar: "",
  isDeleted: true,
};

export const isMissingUserDoc = (user) =>
  !user || typeof user !== "object" || !user._id;

/** Format a User populate result (or dangling id) for API responses. */
export const formatUserRef = (user, extras = {}) => {
  if (isMissingUserDoc(user)) {
    return {
      ...DELETED_USER_DISPLAY,
      id: user?._id || (typeof user === "object" ? null : user) || null,
      ...extras,
    };
  }
  return {
    id: user._id,
    username: user.username,
    name: user.name,
    avatar: user.avatar || "",
    isDeleted: false,
    ...extras,
  };
};
