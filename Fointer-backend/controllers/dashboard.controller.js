import User from "../models/user.js";

export const getOverview = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: `Welcome back, ${req.user.name}.`,
      stats: {
        role: req.user.role,
        accountStatus: "active",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const listUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("username name email role createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      users: users.map((u) => ({
        id: u._id,
        username: u.username,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, email, role } = req.body;

    const target = await User.findById(id);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const isSelf = String(target._id) === String(req.user._id);

    if (role !== undefined) {
      if (!["admin", "user"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role. Allowed: admin, user.",
        });
      }

      if (isSelf && role !== target.role) {
        return res.status(400).json({
          success: false,
          message: "You cannot change your own role.",
        });
      }

      if (target.role === "admin" && role !== "admin") {
        const adminCount = await User.countDocuments({ role: "admin" });
        if (adminCount <= 1) {
          return res.status(400).json({
            success: false,
            message: "Cannot demote the last admin.",
          });
        }
      }

      target.role = role;
    }

    if (name !== undefined) target.name = name.trim();
    if (username !== undefined) target.username = username.trim();
    if (email !== undefined) target.email = email.trim().toLowerCase();

    await target.save();

    return res.status(200).json({
      success: true,
      message: "User updated successfully.",
      user: {
        id: target._id,
        username: target.username,
        name: target.name,
        email: target.email,
        role: target.role,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "field";
      return res.status(400).json({
        success: false,
        message: `${field} already in use.`,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (String(id) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account.",
      });
    }

    const target = await User.findById(id);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (target.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete the last admin.",
        });
      }
    }

    await User.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
