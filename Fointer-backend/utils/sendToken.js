import generateToken from "../config/generateToken.js";

const isProduction = process.env.NODE_ENV === "production";
const useCrossSiteCookies =
  process.env.COOKIE_SAME_SITE === "none" || isProduction;

const sendToken = (user, statusCode, res) => {
  const token = generateToken(user._id, user.role);

  res.cookie("token", token, {
    httpOnly: true,
    secure: useCrossSiteCookies,
    sameSite: useCrossSiteCookies ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
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
    },
  });
};

export default sendToken;
