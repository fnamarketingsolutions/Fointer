import bcrypt from "bcryptjs";
import User from "../models/user.js";
import Community from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import Post from "../models/post.js";
import { getEffectiveMemberRole } from "../utils/communityPermissions.js";
import {
  acceptSignedImageValue,
} from "../utils/s3.js";
import { sendServerError } from "../utils/safeError.js";
import { respondIfBanned } from "../utils/bannedKeywords.js";
import { PHONE_RE, validatePasswordStrength } from "../utils/validate.js";
import { getFollowCounts } from "../utils/followHelpers.js";
import { computeAchievements } from "../utils/publicProfilePayload.js";
import {
  parseAgeRange,
  parseGender,
} from "../utils/profileIdentity.js";
import { normalizePostalCode, postalCodeError } from "../utils/postalCode.js";
import { getAuthCookieOptions } from "../utils/cookieOptions.js";
import {
  getAccountDeletionBlockers,
  purgeUserAccount,
} from "../services/accountDeletion.service.js";
import { countQualifiedReferrals } from "../services/referral.service.js";
import { getHotSnapshot } from "../utils/hotReadCache.js";
import mongoose from "mongoose";

const normalizeInterests = (interests) => {
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

const formatProfileUser = (user) => ({
  id: user._id,
  username: user.username,
  name: user.name,
  email: user.email,
  role: String(user.role || "user").toLowerCase().trim(),
  avatar: user.avatar || "",
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
  ageRange: user.ageRange || "",
  hasPassword: Boolean(user.password),
  hideFollowersList: Boolean(user.hideFollowersList),
  hideFollowingList: Boolean(user.hideFollowingList),
  createdAt: user.createdAt,
});

const asObjectId = (value) =>
  value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));

const membershipStats = (memberships) => {
  const roleMap = {};
  let isMod = false;
  let ownedCount = 0;
  for (const membership of memberships) {
    const role = getEffectiveMemberRole(membership);
    roleMap[String(membership.community)] = role;
    if (role === "owner") ownedCount += 1;
    if (role === "moderator") isMod = true;
  }
  return {
    roleMap,
    isMod,
    ownedCount,
    joinedCount: memberships.length,
    memberCommunityIds: memberships.map((membership) => membership.community),
  };
};

const membershipStatsFromCache = (access) => {
  const roleMap = {};
  let isMod = false;
  let ownedCount = 0;
  const memberCommunityIds = [];
  if (access) {
    for (const [communityId, role] of access.roleByCommunity) {
      roleMap[communityId] = role;
      memberCommunityIds.push(communityId);
      if (role === "owner") ownedCount += 1;
      if (role === "moderator") isMod = true;
    }
  }
  return {
    roleMap,
    isMod,
    ownedCount,
    joinedCount: access?.joinedIdSet?.size || 0,
    memberCommunityIds,
  };
};

const loadMyPosts = (userId) =>
  Post.aggregate([
    { $match: { author: asObjectId(userId) } },
    { $sort: { createdAt: -1 } },
    { $limit: 12 },
    {
      $lookup: {
        from: Community.collection.name,
        localField: "community",
        foreignField: "_id",
        pipeline: [{ $project: { name: 1, shortCode: 1 } }],
        as: "community",
      },
    },
    {
      $set: {
        community: { $ifNull: [{ $arrayElemAt: ["$community", 0] }, null] },
      },
    },
    {
      $project: {
        title: 1,
        text: 1,
        shortCode: 1,
        createdAt: 1,
        community: 1,
      },
    },
  ]);

export const getMyProfile = async (req, res) => {
  try {
    const user = req.user;
    if (!user?._id) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const hot = getHotSnapshot();
    const cacheReady =
      Array.isArray(hot?.allCommunities) && hot?.accessByUser instanceof Map;
    const cachedStats = cacheReady
      ? membershipStatsFromCache(hot.accessByUser.get(String(user._id)))
      : null;
    const communityById = cacheReady
      ? new Map(hot.allCommunities.map((community) => [String(community._id), community]))
      : null;
    const missingCommunityIds = cachedStats
      ? cachedStats.memberCommunityIds.filter((id) => !communityById.has(String(id)))
      : [];

    const [
      passwordRow,
      memberships,
      posts,
      postCount,
      qualifiedReferrals,
      followCounts,
      missingCommunities,
    ] = await Promise.all([
      User.findById(user._id).select("password").lean(),
      cachedStats
        ? Promise.resolve(null)
        : CommunityMember.find({ user: user._id, status: "active" }).lean(),
      loadMyPosts(user._id),
      Post.countDocuments({ author: user._id }),
      countQualifiedReferrals(user._id),
      getFollowCounts(user._id),
      missingCommunityIds.length
        ? Community.find({ _id: { $in: missingCommunityIds } })
            .select("name type shortCode coverImage createdAt")
            .lean()
        : Promise.resolve([]),
    ]);

    const stats = cachedStats || membershipStats(memberships || []);
    let communities = [];
    if (cacheReady) {
      const extras = new Map(
        missingCommunities.map((community) => [String(community._id), community])
      );
      communities = stats.memberCommunityIds
        .map((id) => communityById.get(String(id)) || extras.get(String(id)))
        .filter(Boolean)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    } else if (stats.memberCommunityIds.length) {
      communities = await Community.find({ _id: { $in: stats.memberCommunityIds } })
        .select("name type shortCode coverImage createdAt")
        .sort({ createdAt: -1 })
        .lean();
    }

    const { roleMap, isMod, ownedCount, joinedCount } = stats;

    const achievements = computeAchievements({
      ownedCount,
      joinedCount,
      postCount,
      isMod,
      qualifiedReferrals,
    });

    return res.status(200).json({
      success: true,
      profile: {
        ...formatProfileUser(user),
        hasPassword: Boolean(passwordRow?.password),
        communities: communities.map((c) => ({
          id: c._id,
          name: c.name,
          type: c.type,
          shortCode: c.shortCode || "",
          coverImage: c.coverImage || "",
          membershipRole: roleMap[String(c._id)] || "member",
        })),
        posts: posts.map((p) => ({
          id: p._id,
          title: p.title,
          text: p.text,
          shortCode: p.shortCode || "",
          createdAt: p.createdAt,
          community: p.community
            ? {
                id: p.community._id,
                name: p.community.name,
                shortCode: p.community.shortCode || "",
              }
            : null,
        })),
        achievements,
        stats: {
          communitiesJoined: joinedCount,
          communitiesOwned: ownedCount,
          posts: postCount,
          followers: followCounts.followers,
          following: followCounts.following,
          referrals: qualifiedReferrals,
        },
      },
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const updateMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name || "").trim();
      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty.",
        });
      }
      user.name = name;
    }

    if (req.body.username !== undefined) {
      const username = String(req.body.username || "")
        .trim()
        .replace(/^@+/, "")
        .trim();
      if (!username) {
        return res.status(400).json({
          success: false,
          message: "Username cannot be empty.",
        });
      }
      if (username !== user.username) {
        const usernameExists = await User.findOne({
          username,
          _id: { $ne: user._id },
        });
        if (usernameExists) {
          return res.status(400).json({
            success: false,
            message: "Username already exists.",
          });
        }
        user.username = username;
      }
    }

    if (req.body.bio !== undefined) {
      user.bio = String(req.body.bio || "").trim().slice(0, 500);
    }

    if (req.body.interests !== undefined) {
      user.interests = normalizeInterests(req.body.interests);
    }

    if (req.body.avatar !== undefined) {
      const acceptedAvatar = acceptSignedImageValue(
        req.user._id,
        req.body.avatar,
        user.avatar || ""
      );
      if (!acceptedAvatar.ok) {
        return res.status(400).json({
          success: false,
          message: acceptedAvatar.message,
        });
      }
      user.avatar = acceptedAvatar.url;
    }

    if (req.body.city !== undefined) {
      user.city = String(req.body.city || "").trim().slice(0, 100);
    }

    if (req.body.state !== undefined) {
      user.state = String(req.body.state || "").trim().slice(0, 100);
    }

    if (req.body.country !== undefined) {
      user.country = String(req.body.country || "").trim().slice(0, 100);
    }

    if (req.body.zipCode !== undefined) {
      const zipCode = normalizePostalCode(req.body.zipCode);
      const postalError = postalCodeError(zipCode);
      if (postalError) {
        return res.status(400).json({
          success: false,
          message: postalError,
        });
      }
      user.zipCode = zipCode;
    }

    if (req.body.address !== undefined) {
      user.address = String(req.body.address || "").trim().slice(0, 300);
    }

    if (req.body.district !== undefined) {
      user.district = String(req.body.district || "").trim().slice(0, 100);
    }

    if (req.body.gender !== undefined) {
      const gender = parseGender(req.body.gender);
      if (!gender) {
        return res.status(400).json({
          success: false,
          message: "Gender is required.",
        });
      }
      user.gender = gender;
    }

    if (req.body.phone !== undefined) {
      const phone = String(req.body.phone || "").trim();
      if (phone && !PHONE_RE.test(phone)) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid phone number.",
        });
      }
      user.phone = phone.slice(0, 30);
    }

    if (req.body.ageRange !== undefined) {
      const ageRange = parseAgeRange(req.body.ageRange);
      if (!ageRange) {
        return res.status(400).json({
          success: false,
          message: "Select an age range.",
        });
      }
      user.ageRange = ageRange;
    }

    if (req.body.hideFollowersList !== undefined) {
      user.hideFollowersList = Boolean(req.body.hideFollowersList);
    }

    if (req.body.hideFollowingList !== undefined) {
      user.hideFollowingList = Boolean(req.body.hideFollowingList);
    }

    if (
      await respondIfBanned(
        res,
        req.body.name !== undefined ? user.name : undefined,
        req.body.username !== undefined ? user.username : undefined,
        req.body.bio !== undefined ? user.bio : undefined,
        ...(req.body.interests !== undefined ? user.interests || [] : []),
        req.body.city !== undefined ? user.city : undefined,
        req.body.state !== undefined ? user.state : undefined,
        req.body.district !== undefined ? user.district : undefined,
        req.body.country !== undefined ? user.country : undefined,
        req.body.zipCode !== undefined ? user.zipCode : undefined,
        req.body.address !== undefined ? user.address : undefined
      )
    ) {
      return;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated.",
      user: formatProfileUser(user),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Username already exists.",
      });
    }
    return sendServerError(res, error);
  }
};

export const updateMyPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message:
          "This account uses social login and does not have a password to change.",
      });
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password, new password, and confirmation are required.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New passwords do not match.",
      });
    }

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.ok) {
      return res.status(400).json({
        success: false,
        message: passwordCheck.message,
      });
    }

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const deleteMyAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const role = String(user.role || "user").toLowerCase().trim();
    if (role === "admin" || user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message:
          "Admin accounts cannot be self-deleted. Ask another super admin to remove this account.",
      });
    }

    const { password, confirmText } = req.body || {};

    if (user.password) {
      if (!password) {
        return res.status(400).json({
          success: false,
          message: "Current password is required to delete your account.",
        });
      }
      const match = await bcrypt.compare(String(password), user.password);
      if (!match) {
        return res.status(401).json({
          success: false,
          message: "Password is incorrect.",
        });
      }
    } else {
      const typed = String(confirmText || "").trim().toUpperCase();
      if (typed !== "DELETE") {
        return res.status(400).json({
          success: false,
          message: 'Type DELETE to confirm account deletion.',
        });
      }
    }

    const blockers = await getAccountDeletionBlockers(user._id);
    if (blockers.communities.length || blockers.watchGroups.length) {
      return res.status(400).json({
        success: false,
        message:
          "Transfer or delete communities and watch groups you own before deleting your account.",
        blockers,
      });
    }

    await purgeUserAccount(user._id);

    res.cookie("token", "", {
      ...getAuthCookieOptions(),
      expires: new Date(0),
    });

    return res.status(200).json({
      success: true,
      message: "Account deleted.",
    });
  } catch (error) {
    if (error?.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: error.message || "User not found.",
      });
    }
    return sendServerError(res, error);
  }
};

export const getMyDeletionBlockers = async (req, res) => {
  try {
    const blockers = await getAccountDeletionBlockers(req.user._id);
    const blocked =
      blockers.communities.length > 0 || blockers.watchGroups.length > 0;
    return res.status(200).json({
      success: true,
      blocked,
      blockers,
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};
