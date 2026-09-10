import generateToken from "../config/generateToken.js";
import {
  AUTH_COOKIE_MAX_AGE_MS,
  getAuthCookieOptions,
} from "./cookieOptions.js";
import { getAdminAccessPayload } from "./adminAccess.js";

const sendToken = (user, statusCode, res) => {
  const token = generateToken(user._id, user.role);
  const adminAccess = getAdminAccessPayload(user);

  res.cookie("token", token, {
    ...getAuthCookieOptions(),
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  });

  res.status(statusCode).json({
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
  });
};

export default sendToken;
