import generateToken from "../config/generateToken.js";
import {
  AUTH_COOKIE_MAX_AGE_MS,
  getAuthCookieOptions,
} from "./cookieOptions.js";
import { getAdminAccessPayload } from "./adminAccess.js";

const sendToken = (user, statusCode, res, options = {}) => {
  const token = generateToken(user._id, user.role);
  const adminAccess = getAdminAccessPayload(user);
  const exposeToken = Boolean(options.exposeToken);
  const profileIncomplete =
    !String(user.bio || "").trim() &&
    !(Array.isArray(user.interests) && user.interests.length) &&
    !String(user.city || "").trim();
  const needsProfileSetup = Boolean(options.promptProfileSetup) && profileIncomplete;

  res.cookie("token", token, {
    ...getAuthCookieOptions(),
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  });

  const payload = {
    success: true,
    message: "Success",
    needsProfileSetup,
    user: {
      id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      status: user.status || "active",
      bio: user.bio || "",
      interests: user.interests || [],
      city: user.city || "",
      state: user.state || "",
      district: user.district || "",
      country: user.country || "",
      zipCode: user.zipCode || "",
      address: user.address || "",
      gender: user.gender || "",
      ageRange: user.ageRange || "",
      isSuperAdmin: adminAccess.isSuperAdmin,
      adminTabs: adminAccess.adminTabs,
    },
  };

  // Cross-origin admin SPA (e.g. *.vercel.app → api.fointer.net) cannot
  // reliably use third-party cookies; expose JWT only for admin portal logins.
  if (exposeToken) {
    payload.accessToken = token;
  }

  res.status(statusCode).json(payload);
};

export default sendToken;
