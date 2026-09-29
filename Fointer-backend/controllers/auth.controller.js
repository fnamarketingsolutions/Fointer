import bcrypt from "bcryptjs";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import User from "../models/user.js";
import sendToken from "../utils/sendToken.js";
import sendVerificationEmail from "../utils/sendVerificationEmail.js";
import { sendServerError } from "../utils/safeError.js";
import { getAuthCookieOptions } from "../utils/cookieOptions.js";
import { respondIfBanned } from "../utils/bannedKeywords.js";
import { getAdminAccessPayload } from "../utils/adminAccess.js";
import {
  formatDateOfBirth,
  parseDateOfBirth,
  parseGender,
} from "../utils/profileIdentity.js";
import { normalizePostalCode, postalCodeError } from "../utils/postalCode.js";
import { validatePasswordStrength } from "../utils/validate.js";
import {
  attachReferralOnSignup,
  ensureUserReferralCode,
  qualifyReferralForUser,
} from "../services/referral.service.js";

const MAX_OTP_ATTEMPTS = 5;
/** Fixed bcrypt hash used only to keep login timing similar when user/password missing. */
const DUMMY_PASSWORD_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
const getGoogleClient = () => new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const normalizeSignupInterests = (interests) => {
  if (!interests) return [];
  const list = Array.isArray(interests)
    ? interests
    : String(interests)
        .split(",")
        .map((t) => t.trim());
  return [
    ...new Set(
      list
        .map((t) => String(t).trim())
        .filter(Boolean)
        .slice(0, 20)
    ),
  ];
};

const profileFieldsFromBody = (body = {}) => {
  const bio = String(body.bio || "").trim().slice(0, 500);
  const interests = normalizeSignupInterests(body.interests);
  const city = String(body.city || "").trim().slice(0, 100);
  const state = String(body.state || "").trim().slice(0, 100);
  const district = String(body.district || "").trim().slice(0, 100);
  const country = String(body.country || "").trim().slice(0, 100);
  const zipCode = normalizePostalCode(body.zipCode);
  const address = String(body.address || "").trim().slice(0, 300);
  const gender = parseGender(body.gender);
  const dob = parseDateOfBirth(body.dateOfBirth);
  return {
    bio,
    interests,
    city,
    state,
    district,
    country,
    zipCode,
    address,
    gender,
    dob,
  };
};

const requireSignupIdentity = (res, profile) => {
  if (!profile.gender) {
    res.status(400).json({
      success: false,
      message: "Gender is required.",
    });
    return false;
  }
  if (profile.dob.error) {
    res.status(400).json({
      success: false,
      message: profile.dob.error,
    });
    return false;
  }
  const postalError = postalCodeError(profile.zipCode);
  if (postalError) {
    res.status(400).json({
      success: false,
      message: postalError,
    });
    return false;
  }
  return true;
};

const normalizeRole = (user) => {
  const role = String(user?.role || "user").toLowerCase().trim();
  if (user) user.role = role;
  return role;
};

/** Member portal only — admins must use /api/auth/admin/login */
const rejectIfNotMemberPortal = (res, user) => {
  if (normalizeRole(user) === "admin") {
    res.status(403).json({
      success: false,
      message: "Admin accounts must sign in through the admin portal.",
      code: "ADMIN_PORTAL_REQUIRED",
    });
    return true;
  }
  return false;
};

/** Admin portal only — members must use the user app */
const rejectIfNotAdminPortal = (res, user) => {
  if (normalizeRole(user) !== "admin") {
    res.status(403).json({
      success: false,
      message: "This portal is for administrators only.",
      code: "MEMBER_PORTAL_REQUIRED",
    });
    return true;
  }
  return false;
};

const passwordLogin = async (req, res, { portal }) => {
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

  // Always run a bcrypt compare so missing users / social-only accounts
  // do not return faster than a wrong-password attempt (enumeration).
  const hash = user?.password || DUMMY_PASSWORD_HASH;
  const isMatch = await bcrypt.compare(String(password), hash);

  if (!user || !user.password || !isMatch) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
  }

  // Only after credentials are valid — needed for OTP UX, not for probing.
  if (!user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message:
        "Please verify your email with the 6-digit OTP sent to your inbox.",
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

  if (portal === "admin") {
    if (rejectIfNotAdminPortal(res, user)) return;
    return sendToken(user, 200, res, { exposeToken: true });
  }
  if (rejectIfNotMemberPortal(res, user)) {
    return;
  }

  return sendToken(user, 200, res);
};

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

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.ok) {
      return res.status(400).json({
        success: false,
        message: passwordCheck.message,
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    const profile = profileFieldsFromBody(req.body);
    if (!requireSignupIdentity(res, profile)) return;

    if (
      await respondIfBanned(
        res,
        username,
        name,
        profile.bio || undefined,
        ...profile.interests,
        profile.city || undefined,
        profile.state || undefined,
        profile.district || undefined,
        profile.country || undefined,
        profile.address || undefined
      )
    ) {
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const genericSignup = {
      success: true,
      message:
        "If this email is not already registered, we sent a 6-digit OTP.",
      requiresEmailVerification: true,
      email: normalizedEmail,
    };

    const emailExists = await User.findOne({ email: normalizedEmail });
    if (emailExists) {
      if (!emailExists.isEmailVerified) {
        const { otp, hashedOtp, expiresAt } = createEmailVerificationFields();
        emailExists.emailVerificationOtp = hashedOtp;
        emailExists.emailVerificationOtpExpires = expiresAt;
        emailExists.emailVerificationOtpAttempts = 0;
        if (profile.bio) emailExists.bio = profile.bio;
        if (profile.interests.length) emailExists.interests = profile.interests;
        if (profile.city) emailExists.city = profile.city;
        if (profile.state) emailExists.state = profile.state;
        if (profile.district) emailExists.district = profile.district;
        if (profile.country) emailExists.country = profile.country;
        if (profile.zipCode) emailExists.zipCode = profile.zipCode;
        if (profile.address) emailExists.address = profile.address;
        emailExists.gender = profile.gender;
        emailExists.dateOfBirth = profile.dob.date;
        emailExists.yearOfBirth = profile.dob.year;
        await emailExists.save();
        await sendVerificationEmail({
          to: emailExists.email,
          name: emailExists.name,
          otp,
        });
      }
      return res.status(200).json(genericSignup);
    }

    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({
        success: false,
        message: "Unable to create account with those details.",
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
      bio: profile.bio,
      interests: profile.interests,
      city: profile.city,
      state: profile.state,
      district: profile.district,
      country: profile.country,
      zipCode: profile.zipCode,
      address: profile.address,
      gender: profile.gender,
      dateOfBirth: profile.dob.date,
      yearOfBirth: profile.dob.year,
    });

    try {
      await ensureUserReferralCode(user);
    } catch (referralError) {
      console.error("[referral] code alloc:", referralError?.message || referralError);
    }

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

    await attachReferralOnSignup({
      refereeUser: user,
      referralCode: req.body?.referralCode,
    });

    return res.status(200).json(genericSignup);
  } catch (error) {
    return sendServerError(res, error, "Signup failed. Please try again.");
  }
};

export const login = async (req, res) => {
  try {
    return await passwordLogin(req, res, { portal: "member" });
  } catch (error) {
    return sendServerError(res, error, "Login failed. Please try again.");
  }
};

export const adminLogin = async (req, res) => {
  try {
    return await passwordLogin(req, res, { portal: "admin" });
  } catch (error) {
    return sendServerError(res, error, "Admin login failed. Please try again.");
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

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        success: false,
        message: "Google login is not configured.",
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
      return res.status(401).json({
        success: false,
        message: "Invalid Google token.",
      });
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
      try {
        await ensureUserReferralCode(user);
      } catch (referralError) {
        console.error("[referral] google code:", referralError?.message || referralError);
      }
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

      if (isNewUser) {
        await attachReferralOnSignup({
          refereeUser: user,
          referralCode: req.body?.referralCode,
        });
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

    if (rejectIfNotMemberPortal(res, user)) return;

    return sendToken(user, 200, res, { promptProfileSetup: isNewUser });
  } catch (error) {
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

    const appId = String(process.env.FACEBOOK_APP_ID || "").trim();
    const appSecret = String(process.env.FACEBOOK_APP_SECRET || "").trim();
    if (!appId || !appSecret) {
      return res.status(503).json({
        success: false,
        message: "Facebook login is not configured.",
      });
    }

    const debugParams = new URLSearchParams({
      input_token: accessToken,
      access_token: `${appId}|${appSecret}`,
    });
    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token?${debugParams.toString()}`
    );
    const debugJson = await debugRes.json();
    const debugData = debugJson?.data;
    if (
      !debugRes.ok ||
      !debugData?.is_valid ||
      String(debugData.app_id) !== appId
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired Facebook token.",
      });
    }

    const params = new URLSearchParams({
      fields: "id,name,email,picture.type(large)",
    });
    params.set(
      "appsecret_proof",
      crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex")
    );

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

    if (!facebookId || String(facebookId) !== String(debugData.user_id)) {
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
    let user = await User.findOne({ facebookId });
    let isNewUser = false;

    if (!user) {
      const byEmail = await User.findOne({ email: normalizedEmail });
      if (byEmail) {
        // Do not auto-link Facebook onto an existing account (takeover risk).
        // Keep the message generic to avoid email enumeration.
        return res.status(409).json({
          success: false,
          message:
            "Unable to complete Facebook sign-in for this account. Try another sign-in method.",
          code: "FACEBOOK_SIGNIN_UNAVAILABLE",
        });
      }

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
      try {
        await ensureUserReferralCode(user);
      } catch (referralError) {
        console.error("[referral] facebook code:", referralError?.message || referralError);
      }
    } else if (!user.avatar && avatar) {
      user.avatar = avatar;
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

      if (isNewUser) {
        await attachReferralOnSignup({
          refereeUser: user,
          referralCode: req.body?.referralCode,
        });
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

    if (rejectIfNotMemberPortal(res, user)) return;

    return sendToken(user, 200, res, { promptProfileSetup: isNewUser });
  } catch (error) {
    return sendServerError(
      res,
      error,
      "Facebook login failed. Please try again."
    );
  }
};

/**
 * Admin portal social login — existing admin accounts only (no signup / no new users).
 */
const finishAdminSocialLogin = async (res, user, { providerLabel }) => {
  if (!user) {
    return res.status(403).json({
      success: false,
      message: `No administrator account is linked to this ${providerLabel} login.`,
      code: "ADMIN_ACCOUNT_REQUIRED",
    });
  }

  if (user.status === "suspended" || user.status === "banned") {
    return res.status(403).json({
      success: false,
      message: `Your account is ${user.status}. Contact support.`,
    });
  }

  if (rejectIfNotAdminPortal(res, user)) return;

  if (!user.isEmailVerified) {
    user.isEmailVerified = true;
    clearEmailVerification(user);
    await user.save();
  }

  return sendToken(user, 200, res, { exposeToken: true });
};

export const adminGoogleLogin = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Google token is required.",
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        success: false,
        message: "Google login is not configured.",
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
      return res.status(401).json({
        success: false,
        message: "Invalid Google token.",
      });
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

    // Do not mutate non-admin accounts before portal role check.
    if (user && normalizeRole(user) === "admin") {
      if (!user.googleId) user.googleId = googleId;
      if (picture) user.avatar = picture;
      if (name) user.name = name;
      await user.save();
    }

    return finishAdminSocialLogin(res, user, { providerLabel: "Google" });
  } catch (error) {
    return sendServerError(
      res,
      error,
      "Admin Google login failed. Please try again."
    );
  }
};

export const adminFacebookLogin = async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: "Facebook access token is required.",
      });
    }

    const appId = String(process.env.FACEBOOK_APP_ID || "").trim();
    const appSecret = String(process.env.FACEBOOK_APP_SECRET || "").trim();
    if (!appId || !appSecret) {
      return res.status(503).json({
        success: false,
        message: "Facebook login is not configured.",
      });
    }

    const debugParams = new URLSearchParams({
      input_token: accessToken,
      access_token: `${appId}|${appSecret}`,
    });
    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token?${debugParams.toString()}`
    );
    const debugJson = await debugRes.json();
    const debugData = debugJson?.data;
    if (
      !debugRes.ok ||
      !debugData?.is_valid ||
      String(debugData.app_id) !== appId
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired Facebook token.",
      });
    }

    const params = new URLSearchParams({
      fields: "id,name,email,picture.type(large)",
    });
    params.set(
      "appsecret_proof",
      crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex")
    );

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

    if (!facebookId || String(facebookId) !== String(debugData.user_id)) {
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

    // Only match a pre-linked Facebook id — never auto-link by email (takeover risk).
    let user = await User.findOne({ facebookId });

    if (user && normalizeRole(user) === "admin") {
      if (!user.avatar && avatar) user.avatar = avatar;
      if (name) user.name = name;
      await user.save();
    } else {
      user = null;
    }

    return finishAdminSocialLogin(res, user, { providerLabel: "Facebook" });
  } catch (error) {
    return sendServerError(
      res,
      error,
      "Admin Facebook login failed. Please try again."
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

    const expected = String(user.emailVerificationOtp || "");
    const left = Buffer.from(hashedOtp, "utf8");
    const right = Buffer.from(expected, "utf8");
    const otpMatches =
      left.length === right.length && crypto.timingSafeEqual(left, right);

    if (!otpMatches) {
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

    await qualifyReferralForUser(user, { io: req.app?.get?.("io") });

    if (rejectIfNotMemberPortal(res, user)) return;

    return sendToken(user, 200, res, { promptProfileSetup: true });
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

    const genericResend = {
      success: true,
      message: "If that email needs verification, we sent a new code.",
    };

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
    });

    if (!user || user.isEmailVerified) {
      return res.status(200).json(genericResend);
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

    return res.status(200).json(genericResend);
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

    const adminAccess = getAdminAccessPayload(user);

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
        city: user.city || "",
        state: user.state || "",
        country: user.country || "",
        zipCode: user.zipCode || "",
        address: user.address || "",
        district: user.district || "",
        phone: user.phone || "",
        gender: user.gender || "",
        dateOfBirth: formatDateOfBirth(user.dateOfBirth),
        yearOfBirth: user.yearOfBirth ?? null,
        isSuperAdmin: adminAccess.isSuperAdmin,
        adminTabs: adminAccess.adminTabs,
      },
    });
  } catch (error) {
    return sendServerError(res, error, "Could not load profile.");
  }
};
