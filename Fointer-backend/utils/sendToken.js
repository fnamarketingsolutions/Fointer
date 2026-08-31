import generateToken from "../config/generateToken.js";
import {
  AUTH_COOKIE_MAX_AGE_MS,
  getAuthCookieOptions,
} from "./cookieOptions.js";

const sendToken = (user, statusCode, res) => {
  const token = generateToken(user._id, user.role);

  res.cookie("token", token, {
    ...getAuthCookieOptions(),
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  });

  res.status(statusCode).json({
    success: true,
    message: "Success",
    token,
    user: {
      id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      status: user.status || "active",
    },
  });
};

export default sendToken;
