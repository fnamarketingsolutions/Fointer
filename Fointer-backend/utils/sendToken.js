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

  res.cookie("token", token, {
    ...getAuthCookieOptions(),
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  });

  const payload = {
    success: true,
    message: "Success",
    user: {
      id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      status: user.status || "active",
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
