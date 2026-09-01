import SupportTicket from "../models/supportTicket.js";
import Channel from "../models/channel.js";
import Subchannel from "../models/subchannel.js";
import {
  sendSupportRequestEmail,
  sendSupportStatusUpdateEmail,
} from "../utils/sendVerificationEmail.js";
import { sendServerError } from "../utils/safeError.js";
import { respondIfBanned } from "../utils/bannedKeywords.js";
import { notify, notifyAdmins, personName, snippet } from "../utils/notify.js";
import mongoose from "mongoose";

const VALID_STATUSES = ["pending", "rejected", "approved"];
const MAX_NAME_LENGTH = 80;

const normalizeStatus = (status) => {
  const value = String(status || "").toLowerCase();
  if (VALID_STATUSES.includes(value)) return value;
  if (value === "open" || value === "in_review") return "pending";
  if (value === "resolved") return "approved";
  if (value === "closed") return "rejected";
  return "pending";
};

const normalizeName = (value) => String(value || "").trim().replace(/\s+/g, " ");

const formatTicket = (ticket) => {
  const user = ticket.user;
  const channelName = ticket.fulfilledChannelName || "";
  const subchannelName = ticket.fulfilledSubchannelName || "";
  return {
    id: ticket._id,
    description: ticket.description || "",
    status: normalizeStatus(ticket.status),
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    user:
      user && typeof user === "object" && user._id
        ? {
            id: user._id,
            username: user.username,
            name: user.name,
            email: user.email,
          }
        : { id: ticket.user },
    fulfilled:
      channelName || subchannelName
        ? {
            channel: channelName,
            subchannel: subchannelName,
          }
        : null,
  };
};

const fulfillChannelRequest = async ({ channelId, channelName, subchannelName }) => {
  const subName = normalizeName(subchannelName);
  if (!subName) {
    return {
      error: {
        status: 400,
        message: "Subchannel name is required to approve this request.",
      },
    };
  }
  if (subName.length > MAX_NAME_LENGTH) {
    return {
      error: {
        status: 400,
        message: `Subchannel name must be ${MAX_NAME_LENGTH} characters or fewer.`,
      },
    };
  }

  const existingChannelId = String(channelId || "").trim();
  const newChannelName = normalizeName(channelName);
  let channel = null;
  let createdChannel = false;

  if (existingChannelId) {
    if (!mongoose.Types.ObjectId.isValid(existingChannelId)) {
      return {
        error: { status: 400, message: "A valid parent channel is required." },
      };
    }
    channel = await Channel.findById(existingChannelId);
    if (!channel) {
      return {
        error: { status: 404, message: "Parent channel not found." },
      };
    }
  } else {
    if (!newChannelName) {
      return {
        error: {
          status: 400,
          message:
            "Create a new channel or select an existing one before approving.",
        },
      };
    }
    if (newChannelName.length > MAX_NAME_LENGTH) {
      return {
        error: {
          status: 400,
          message: `Channel name must be ${MAX_NAME_LENGTH} characters or fewer.`,
        },
      };
    }

    const nameNormalized = newChannelName.toLowerCase();
    const existing = await Channel.findOne({ nameNormalized });
    if (existing) {
      return {
        error: {
          status: 400,
          message:
            "A channel with this name already exists. Select it as the parent channel instead.",
        },
      };
    }

    channel = await Channel.create({
      name: newChannelName,
      nameNormalized,
    });
    createdChannel = true;
  }

  const subNormalized = subName.toLowerCase();
  const existingSub = await Subchannel.findOne({
    channel: channel._id,
    nameNormalized: subNormalized,
  });
  if (existingSub) {
    if (createdChannel) {
      await Channel.deleteOne({ _id: channel._id });
    }
    return {
      error: {
        status: 400,
        message:
          "A subchannel with this name already exists in the selected channel. Create a new one to approve.",
      },
    };
  }

  try {
    const subchannel = await Subchannel.create({
      name: subName,
      nameNormalized: subNormalized,
      channel: channel._id,
    });
    return { channel, subchannel };
  } catch (error) {
    if (createdChannel) {
      await Channel.deleteOne({ _id: channel._id });
    }
    throw error;
  }
};

export const createSupportTicket = async (req, res) => {
  try {
    const description = String(req.body?.description || "").trim();
    if (!description) {
      return res.status(400).json({
        success: false,
        message: "Description is required.",
      });
    }

    if (description.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Description must be 5000 characters or fewer.",
      });
    }

    if (await respondIfBanned(res, description)) return;

    const ticket = await SupportTicket.create({
      user: req.user._id,
      description,
      status: "pending",
    });

    try {
      await sendSupportRequestEmail({
        userName: req.user.username || req.user.name,
        description,
      });
    } catch (emailError) {
      console.error("Support email failed:", emailError.message);
    }

    await notifyAdmins({
      io: req.app.get("io"),
      actor: req.user,
      type: "channel_request",
      title: `${personName(req.user)} submitted a channel request`,
      body: snippet(description),
      entity: {
        kind: "support_ticket",
        id: ticket._id,
        title: snippet(description, 80),
      },
    });

    return res.status(201).json({
      success: true,
      ticket: formatTicket(ticket),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const listMySupportTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate("user", "username name email");

    return res.status(200).json({
      success: true,
      tickets: tickets.map(formatTicket),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const listAdminSupportTickets = async (req, res) => {
  try {
    const status = String(req.query?.status || "").trim().toLowerCase();
    const filter = {};

    if (status && VALID_STATUSES.includes(status)) {
      filter.status = status;
    }

    const tickets = await SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .populate("user", "username name email");

    return res.status(200).json({
      success: true,
      tickets: tickets.map(formatTicket),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const updateSupportTicketStatus = async (req, res) => {
  try {
    const ticketId = req.params?.id;
    const status = String(req.body?.status || "").trim().toLowerCase();

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be pending, rejected, or approved.",
      });
    }

    const ticket = await SupportTicket.findById(ticketId).populate(
      "user",
      "username name email"
    );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Support request not found.",
      });
    }

    if (ticket.status === status) {
      return res.status(200).json({
        success: true,
        ticket: formatTicket(ticket),
      });
    }

    let fulfilledChannelId = ticket.fulfilledChannelId;
    let fulfilledChannelName = ticket.fulfilledChannelName;
    let fulfilledSubchannelId = ticket.fulfilledSubchannelId;
    let fulfilledSubchannelName = ticket.fulfilledSubchannelName;

    if (status === "approved") {
      try {
        const result = await fulfillChannelRequest({
          channelId: req.body?.channelId,
          channelName: req.body?.channelName,
          subchannelName: req.body?.subchannelName,
        });
        if (result.error) {
          return res.status(result.error.status).json({
            success: false,
            message: result.error.message,
          });
        }
        fulfilledChannelId = result.channel._id;
        fulfilledChannelName = result.channel.name;
        fulfilledSubchannelId = result.subchannel._id;
        fulfilledSubchannelName = result.subchannel.name;
      } catch (error) {
        if (error?.code === 11000) {
          return res.status(400).json({
            success: false,
            message:
              "That channel or subchannel already exists. Create a new one to approve.",
          });
        }
        throw error;
      }
    }

    ticket.status = status;
    ticket.fulfilledChannelId = fulfilledChannelId;
    ticket.fulfilledChannelName = fulfilledChannelName;
    ticket.fulfilledSubchannelId = fulfilledSubchannelId;
    ticket.fulfilledSubchannelName = fulfilledSubchannelName;
    await ticket.save();

    const user = ticket.user;
    if (user?.email) {
      try {
        await sendSupportStatusUpdateEmail({
          to: user.email,
          userName: user.username || user.name,
          status,
          channelName: fulfilledChannelName,
          subchannelName: fulfilledSubchannelName,
        });
      } catch (emailError) {
        console.error("Support status email failed:", emailError.message);
      }
    }

    if (status === "approved" || status === "rejected") {
      await notify({
        io: req.app.get("io"),
        recipientId: user?._id || ticket.user,
        actor: req.user,
        type: "support_ticket",
        title:
          status === "approved"
            ? "Your channel request was approved"
            : "Your channel request was rejected",
        body:
          status === "approved" && fulfilledChannelName
            ? `${fulfilledChannelName} / ${fulfilledSubchannelName || ""} is now available when you create a community.`
            : "",
        entity: { kind: "support_ticket", id: ticket._id },
      });
    }

    return res.status(200).json({
      success: true,
      ticket: formatTicket(ticket),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};
