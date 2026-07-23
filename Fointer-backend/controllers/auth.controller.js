import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import User from "../models/user.js";
import sendToken from "../utils/sendToken.js";

const getGoogleClient = () => new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const signup = async (req, res) => {
  try {
    const {
      username,
      name,
      email,
      password,
      confirmPassword,
    } = req.body;

   
    if (
      !username ||
      !name ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    // Check Password Match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    // Check Existing Email
    const emailExists = await User.findOne({ email });

    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: "Email already exists.",
      });
    }

    // Check Existing Username
    const usernameExists = await User.findOne({ username });

    if (usernameExists) {
      return res.status(400).json({
        success: false,
        message: "Username already exists.",
      });
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create User
    const user = await User.create({
      username,
      name,
      email,
      password: hashedPassword,
      role: "user",
    });

    return sendToken(user, 201, res);

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate Fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    // Find User
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // OAuth-only accounts have no password
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

    // Compare Password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Generate JWT & Store in Cookie
    return sendToken(user, 200, res);

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

// ==============================
// Google OAuth Login / Signup
// ==============================
export const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Google token is required.",
      });
    }

    let email, name, picture, googleId;

    try {
      // Try verifying as ID Token first
      const ticket = await getGoogleClient().verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      googleId = payload.sub;
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    } catch {
      // Fallback: OAuth access token from useGoogleLogin
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
    }

    if (!email || !googleId) {
      return res.status(401).json({
        success: false,
        message: "Unable to read Google account details.",
      });
    }

    // Find user by email or googleId
    let user =
      (await User.findOne({ email })) ||
      (await User.findOne({ googleId }));

    if (!user) {
      const baseUsername = email
        .split("@")[0]
        .replace(/[^a-zA-Z0-9._]/g, "")
        .slice(0, 20) || "user";
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const username = `${baseUsername}_${randomNum}`;

      user = await User.create({
        username,
        name: name || baseUsername,
        email,
        googleId,
        avatar: picture,
        role: "user",
      });
    } else {
      // Link Google to existing email account if needed
      if (!user.googleId) user.googleId = googleId;
      if (picture && !user.avatar) user.avatar = picture;
      if (name && !user.name) user.name = name;
      await user.save();
    }

    return sendToken(user, 200, res);
  } catch (error) {
    console.error("Google login error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// facebook login //
export const facebookLogin = async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: "Facebook access token is required.",
      });
    }

    // 1. Fetch user info directly from Facebook Graph API
    const graphUrl = `https://graph.facebook.com/v19.0/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`;
    const fbRes = await fetch(graphUrl);
    const fbData = await fbRes.json();

    if (fbData.error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired Facebook token.",
      });
    }

    const { id: facebookId, name, email, picture } = fbData;
    const avatar = picture?.data?.url;

    // Fallback: If Facebook user didn't attach an email to their FB account (e.g., registered via phone number)
    const userEmail = email || `${facebookId}@facebook.com`;

    // 2. Query MongoDB by email or facebookId
    let user = await User.findOne({
      $or: [{ email: userEmail }, { facebookId }],
    });

    if (!user) {
      // Generate a unique fallback username
      const baseUsername = (name || "fb_user").toLowerCase().replace(/\s+/g, "");
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const username = `${baseUsername}_${randomNum}`;

      // Create new user in database (no password required)
      user = await User.create({
        username,
        name: name || "Facebook User",
        email: userEmail,
        facebookId,
        avatar,
        role: "user",
      });
      console.log("✅ NEW USER SAVED TO MONGO DB:", user);
    } else if (!user.facebookId) {
      console.log("ℹ️ EXISTING USER FOUND IN DB:", user._id);
      // Link facebookId if user already registered via regular email form
      user.facebookId = facebookId;
      if (!user.avatar) user.avatar = avatar;
      await user.save();
    }

    // 3. Issue JWT Token inside HTTP-Only cookie
    return sendToken(user, 200, res);

  } catch (error) {
    console.error("Facebook login error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==============================
// Logout
// ==============================
export const logout = (req, res) => {

  res.cookie("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
  });

  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });

};

// ==============================
// Get Logged In User
// ==============================
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
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};