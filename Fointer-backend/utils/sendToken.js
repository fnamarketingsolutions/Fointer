import generateToken from "../config/generateToken.js";

const sendToken = (user, statusCode, res) => {
  const token = generateToken(user._id, user.role);

  res.cookie("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
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
    },
  });
};

export default sendToken;