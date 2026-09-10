import User from "../models/user.js";
import Follow from "../models/follow.js";
import {
  formatFollowUser,
  getFollowCounts,
  isFollowing,
} from "../utils/followHelpers.js";
import { normalizeUsername } from "./user.controller.js";
import { notify, personName } from "../utils/notify.js";
import { sendServerError } from "../utils/safeError.js";
import {
  buildPaginationMeta,
  parsePagination,
  takePage,
} from "../utils/pagination.js";

const findActiveUserByUsername = async (username) => {
  const clean = normalizeUsername(username);
  if (!clean) return null;
  return User.findOne({ username: clean, status: "active" }).select(
    "username name avatar bio status"
  );
};

export const followUser = async (req, res) => {
  try {
    const target = await findActiveUserByUsername(req.params.username);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (String(target._id) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot follow yourself.",
      });
    }

    const existing = await Follow.findOne({
      follower: req.user._id,
      following: target._id,
    });

    if (existing) {
      const counts = await getFollowCounts(target._id);
      return res.status(200).json({
        success: true,
        message: "Already following.",
        following: true,
        followerCount: counts.followers,
        followingCount: counts.following,
      });
    }

    await Follow.create({
      follower: req.user._id,
      following: target._id,
    });

    const io = req.app.get("io");
    await notify({
      io,
      recipientId: target._id,
      actor: req.user,
      type: "follow",
      title: `${personName(req.user)} started following you`,
      entity: {
        kind: "user",
        _id: req.user._id,
        name: req.user.name,
        username: req.user.username,
      },
    });

    const counts = await getFollowCounts(target._id);

    return res.status(200).json({
      success: true,
      message: "Following.",
      following: true,
      followerCount: counts.followers,
      followingCount: counts.following,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(200).json({
        success: true,
        message: "Already following.",
        following: true,
      });
    }
    return sendServerError(res, error);
  }
};

export const unfollowUser = async (req, res) => {
  try {
    const target = await findActiveUserByUsername(req.params.username);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    await Follow.deleteOne({
      follower: req.user._id,
      following: target._id,
    });

    const counts = await getFollowCounts(target._id);

    return res.status(200).json({
      success: true,
      message: "Unfollowed.",
      following: false,
      followerCount: counts.followers,
      followingCount: counts.following,
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

const listFollowRelations = async (req, res, field) => {
  try {
    const user = await findActiveUserByUsername(req.params.username);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const { enabled, page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    let query = Follow.find({ [field]: user._id })
      .sort({ createdAt: -1 })
      .populate(
        field === "following" ? "follower" : "following",
        "username name avatar bio status"
      )
      .lean();

    if (enabled) {
      query = query.skip(skip).limit(limit + 1);
    } else {
      query = query.limit(limit);
    }

    const found = await query;
    const { rows, hasMore } = enabled
      ? takePage(found, limit)
      : { rows: found, hasMore: false };

    const userField = field === "following" ? "follower" : "following";
    const users = rows
      .map((row) => row[userField])
      .filter((item) => item && item.status === "active")
      .map(formatFollowUser);

    const payload = {
      success: true,
      users,
    };

    if (enabled) {
      payload.pagination = buildPaginationMeta({ page, limit, hasMore });
    }

    return res.status(200).json(payload);
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const listFollowers = (req, res) =>
  listFollowRelations(req, res, "following");

export const listFollowing = (req, res) =>
  listFollowRelations(req, res, "follower");
