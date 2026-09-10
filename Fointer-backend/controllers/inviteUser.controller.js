import Community from "../models/community.js";

import User from "../models/user.js";

import { canManageCommunity } from "../utils/communityPermissions.js";

import { sendServerError } from "../utils/safeError.js";

import { escapeRegex } from "../utils/validate.js";

import {

  formatInvite,

  resolveInviteeUser,

  assertInviteeEligible,

  createAndDeliverCommunityInvite,

} from "../utils/communityInviteService.js";



const assertOwnerCanInvite = (community, user) =>

  canManageCommunity(community, user);



export const lookupInviteUser = async (req, res) => {

  try {

    const community = await Community.findById(req.params.id);



    if (!community) {

      return res.status(404).json({

        success: false,

        message: "Community not found.",

      });

    }



    if (!assertOwnerCanInvite(community, req.user)) {

      return res.status(403).json({

        success: false,

        message: "Only the community owner can look up users to invite.",

      });

    }



    if (!["private_request", "private_invite"].includes(community.type)) {

      return res.status(400).json({

        success: false,

        message: "Invites are only allowed for private communities.",

      });

    }



    const query = String(req.query.username || req.query.q || "").trim();

    if (!query) {

      return res.status(400).json({

        success: false,

        message: "Provide a username or email to look up.",

      });

    }



    if (query.length < 3) {

      return res.status(400).json({

        success: false,

        message: "Type at least 3 characters ",

      });

    }



    const looksLikeEmail = query.includes("@");

    const user = looksLikeEmail

      ? await User.findOne({ email: query.toLowerCase() }).select(

          "username name avatar"

        )

      : await User.findOne({

          username: new RegExp(`^${escapeRegex(query)}$`, "i"),

        }).select("username name avatar");



    return res.status(200).json({

      success: true,

      users: user

        ? [

            {

              id: user._id,

              username: user.username,

              name: user.name || "",

              avatar: user.avatar || "",

            },

          ]

        : [],

    });

  } catch (error) {

    return sendServerError(res, error);

  }

};



export const inviteUserToCommunity = async (req, res) => {

  try {

    const community = await Community.findById(req.params.id);



    if (!community) {

      return res.status(404).json({

        success: false,

        message: "Community not found.",

      });

    }



    if (!["private_request", "private_invite"].includes(community.type)) {

      return res.status(400).json({

        success: false,

        message: "Invites are only allowed for private communities.",

      });

    }



    if (!assertOwnerCanInvite(community, req.user)) {

      return res.status(403).json({

        success: false,

        message: "Only the community owner can invite members.",

      });

    }



    const invitee = await resolveInviteeUser({

      userId: req.body?.userId,

      username: req.body?.username,

    });



    if (!invitee) {

      return res.status(404).json({

        success: false,

        message: "No user found with that username.",

      });

    }



    const eligibilityError = await assertInviteeEligible(

      community._id,

      invitee._id,

      req.user._id

    );

    if (eligibilityError) {

      return res.status(eligibilityError.status).json({

        success: false,

        message: eligibilityError.message,

      });

    }



    try {

      const invite = await createAndDeliverCommunityInvite({

        community,

        inviter: req.user,

        invitee,

        message: req.body?.message,

        io: req.app.get("io"),

      });



      return res.status(201).json({

        success: true,

        message: "Invite sent.",

        invite,

      });

    } catch (emailError) {

      return res.status(500).json({

        success: false,

        message:

          emailError.message ||

          "Failed to send invite email. Please try again.",

      });

    }

  } catch (error) {

    return sendServerError(res, error);

  }

};

