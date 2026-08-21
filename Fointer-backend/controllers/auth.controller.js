import bcrypt from "bcryptjs";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import User from "../models/user.js";
import sendToken from "../utils/sendToken.js";
import sendVerificationEmail from "../utils/sendVerificationEmail.js";
import { sendServerError } from "../utils/safeError.js";
import { getAuthCookieOptions } from "../utils/cookieOptions.js";
import { respondIfBanned } from "../utils/bannedKeywords.js";

const MAX_OTP_ATTEMPTS = 5;
const getGoogleClient = () => new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const createEmailVerificationFields = () => {
  const otp = String(crypto.randomInt(100000, 1000000));
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  return {
    otp,
    hashedOtp,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  };
};

const randomUsernameSuffix = () => crypto.randomInt(1000, 10000);

const clearEmailVerification = (user) => {
  user.emailVerificationOtp = undefined;
  user.emailVerificationOtpExpires = undefined;
  user.emailVerificationOtpAttempts = 0;
};

export const signup = async (req, res) => {
  try {
    const { username, name, email, password, confirmPassword } = req.body;

    if (!username || !name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    if (await respondIfBanned(res, username, name)) return;

    const normalizedEmail = String(email).trim().toLowerCase();

    const emailExists = await User.findOne({ email: normalizedEmail });
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: "Email already exists.",
      });
    }

    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({
        success: false,
        message: "Username already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { otp, hashedOtp, expiresAt } = createEmailVerificationFields();

    const user = await User.create({
      username,
      name,
      email: normalizedEmail,
      password: hashedPassword,
      isEmailVerified: false,
      emailVerificationOtp: hashedOtp,
      emailVerificationOtpExpires: expiresAt,
      emailVerificationOtpAttempts: 0,
      role: "user",
    });

    try {
      await sendVerificationEmail({
        to: user.email,
        name: user.name,
        otp,
      });
    } catch (mailError) {
      await User.deleteOne({ _id: user._id });
      throw mailError;
    }

    return res.status(201).json({
      success: true,
      message: "Account created. Enter the 6-digit OTP sent to your email.",
      requiresEmailVerification: true,
      email: user.email,
    });
  } catch (error) {
    return sendServerError(res, error, "Signup failed. Please try again.");
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message:
          "Please verify your email with the 6-digit OTP sent to your inbox.",
        requiresEmailVerification: true,
        email: user.email,
      });
    }

    if (!user.password) {
      const providers = [];
      if (user.googleId) providers.push("Google");
      if (user.facebookId) providers.push("Facebook");
      const providerLabel = providers.length
        ? providers.join(" or ")
        : "social";

      return res.status(401).json({
        success: false,
        message: `This account uses ${providerLabel} sign-in. Please continue with ${providerLabel}.`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (user.status === "suspended" || user.status === "banned") {
      return res.status(403).json({
        success: false,
        message: `Your account is ${user.status}. Contact support.`,
      });
    }

    if (user.role) user.role = String(user.role).toLowerCase().trim();

    return sendToken(user, 200, res);
  } catch (error) {
    return sendServerError(res, error, "Login failed. Please try again.");
  }
};

export const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Google token is required.",
      });
    }

    let email;
    let name;
    let picture;
    let googleId;
    let emailVerified = false;

    try {
      const ticket = await getGoogleClient().verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      googleId = payload.sub;
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
      emailVerified = payload.email_verified === true;
    } catch {
      const userInfoRes = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!userInfoRes.ok) {
        return res.status(401).json({
          success: false,
          message: "Invalid Google token.",
        });
      }

      const googleUser = await userInfoRes.json();
      googleId = googleUser.sub;
      email = googleUser.email;
      name = googleUser.name;
      picture = googleUser.picture;
      emailVerified =
        googleUser.email_verified === true ||
        googleUser.verified_email === true;
    }

    if (!email || !googleId) {
      return res.status(401).json({
        success: false,
        message: "Unable to read Google account details.",
      });
    }

    if (!emailVerified) {
      return res.status(401).json({
        success: false,
        message: "Google email is not verified.",
      });
    }

    const normalizedEmail = email.toLowerCase();
    let user =
      (await User.findOne({ email: normalizedEmail })) ||
      (await User.findOne({ googleId }));
    let isNewUser = false;

    if (!user) {
      const baseUsername =
        normalizedEmail
          .split("@")[0]
          .replace(/[^a-zA-Z0-9._]/g, "")
          .slice(0, 20) || "user";
      const username = `${baseUsername}_${randomUsernameSuffix()}`;

      user = await User.create({
        username,
        name: name || baseUsername,
        email: normalizedEmail,
        googleId,
        avatar: picture,
        isEmailVerified: false,
        role: "user",
      });
      isNewUser = true;
    } else {
      if (!user.googleId) user.googleId = googleId;
      if (picture) user.avatar = picture;
      if (name) user.name = name;
      if (user.role) user.role = String(user.role).toLowerCase().trim();
      await user.save();
    }

    if (!user.isEmailVerified) {
      const { otp, hashedOtp, expiresAt } = createEmailVerificationFields();
      user.emailVerificationOtp = hashedOtp;
      user.emailVerificationOtpExpires = expiresAt;
      user.emailVerificationOtpAttempts = 0;
      await user.save();

      try {
        await sendVerificationEmail({
          to: user.email,
          name: user.name,
          otp,
        });
      } catch (mailError) {
        if (isNewUser) {
          await User.deleteOne({ _id: user._id });
        }
        throw mailError;
      }

      return res.status(200).json({
        success: true,
        message:
          "Enter the 6-digit OTP sent to your email to finish Google sign-in.",
        requiresEmailVerification: true,
        email: user.email,
      });
    }

    if (user.status === "suspended" || user.status === "banned") {
      return res.status(403).json({
        success: false,
        message: `Your account is ${user.status}. Contact support.`,
      });
    }

    return sendToken(user, 200, res);
  } catch (error) {
    console.error("Google login error:", error);
    return sendServerError(res, error, "Google login failed. Please try again.");
  }
};

export const facebookLogin = async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: "Facebook access token is required.",
      });
    }

    const params = new URLSearchParams({
      fields: "id,name,email,picture.type(large)",
    });

    const appSecret = String(process.env.FACEBOOK_APP_SECRET || "").trim();
    if (appSecret) {
      params.set(
        "appsecret_proof",
        crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex")
      );
    }

    const fbRes = await fetch(
      `https://graph.facebook.com/v19.0/me?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const fbData = await fbRes.json();

    if (!fbRes.ok || fbData.error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired Facebook token.",
      });
    }

    const { id: facebookId, name, email, picture } = fbData;
    const avatar = picture?.data?.url;

    if (!facebookId) {
      return res.status(401).json({
        success: false,
        message: "Unable to read Facebook account details.",
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message:
          "Facebook did not provide an email. Grant email permission or use another sign-in method.",
      });
    }

    const normalizedEmail = String(email).toLowerCase();
    let user = await User.findOne({
      $or: [{ email: normalizedEmail }, { facebookId }],
    });
    let isNewUser = false;

    if (!user) {
      const baseUsername = (name || "fb_user")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9._]/g, "")
        .slice(0, 20) || "fb_user";
      const username = `${baseUsername}_${randomUsernameSuffix()}`;

      user = await User.create({
        username,
        name: name || "Facebook User",
        email: normalizedEmail,
        facebookId,
        avatar,
        isEmailVerified: false,
        role: "user",
      });
      isNewUser = true;
    } else if (!user.facebookId) {
      user.facebookId = facebookId;
      if (!user.avatar && avatar) user.avatar = avatar;
      await user.save();
    }

    if (!user.isEmailVerified) {
      const { otp, hashedOtp, expiresAt } = createEmailVerificationFields();
      user.emailVerificationOtp = hashedOtp;
      user.emailVerificationOtpExpires = expiresAt;
      user.emailVerificationOtpAttempts = 0;
      await user.save();

      try {
        await sendVerificationEmail({
          to: user.email,
          name: user.name,
          otp,
        });
      } catch (mailError) {
        if (isNewUser) {
          await User.deleteOne({ _id: user._id });
        }
        throw mailError;
      }

      return res.status(200).json({
        success: true,
        message:
          "Enter the 6-digit OTP sent to your email to finish Facebook sign-in.",
        requiresEmailVerification: true,
        email: user.email,
      });
    }

    if (user.status === "suspended" || user.status === "banned") {
      return res.status(403).json({
        success: false,
        message: `Your account is ${user.status}. Contact support.`,
      });
    }

    return sendToken(user, 200, res);
  } catch (error) {
    console.error("Facebook login error:", error);
    return sendServerError(
      res,
      error,
      "Facebook login failed. Please try again."
    );
  }
};

export const logout = (req, res) => {
  res.cookie("token", "", {
    ...getAuthCookieOptions(),
    expires: new Date(0),
  });

  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
};

export const verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !user.emailVerificationOtp || !user.emailVerificationOtpExpires) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP.",
      });
    }

    if (user.emailVerificationOtpExpires <= new Date()) {
      clearEmailVerification(user);
      await user.save();
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP.",
      });
    }

    if ((user.emailVerificationOtpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      clearEmailVerification(user);
      await user.save();
      return res.status(429).json({
        success: false,
        message: "Too many invalid OTP attempts. Request a new code.",
      });
    }

    const hashedOtp = crypto
      .createHash("sha256")
      .update(String(otp).trim())
      .digest("hex");

    if (hashedOtp !== user.emailVerificationOtp) {
      user.emailVerificationOtpAttempts =
        (user.emailVerificationOtpAttempts || 0) + 1;
      if (user.emailVerificationOtpAttempts >= MAX_OTP_ATTEMPTS) {
        clearEmailVerification(user);
        await user.save();
        return res.status(429).json({
          success: false,
          message: "Too many invalid OTP attempts. Request a new code.",
        });
      }
      await user.save();
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP.",
      });
    }

    user.isEmailVerified = true;
    clearEmailVerification(user);
    await user.save();

    return sendToken(user, 200, res);
  } catch (error) {
    return sendServerError(
      res,
      error,
      "Email verification failed. Please try again."
    );
  }
};

export const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with that email.",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "This email is already verified.",
      });
    }

    const { otp, hashedOtp, expiresAt } = createEmailVerificationFields();
    user.emailVerificationOtp = hashedOtp;
    user.emailVerificationOtpExpires = expiresAt;
    user.emailVerificationOtpAttempts = 0;
    await user.save();

    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      otp,
    });

    return res.status(200).json({
      success: true,
      message: "A new OTP has been sent to your email.",
    });
  } catch (error) {
    return sendServerError(
      res,
      error,
      "Could not resend verification email. Please try again."
    );
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: String(user.role || "user").toLowerCase().trim(),
        avatar: user.avatar,
        status: user.status || "active",
        bio: user.bio || "",
        interests: user.interests || [],
      },
    });
  } catch (error) {
    return sendServerError(res, error, "Could not load profile.");
  }
};
