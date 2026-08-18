import SupportTicket from "../models/supportTicket.js";
import {
  sendSupportRequestEmail,
  sendSupportStatusUpdateEmail,
} from "../utils/sendVerificationEmail.js";
import { sendServerError } from "../utils/safeError.js";

const VALID_STATUSES = ["pending", "rejected", "approved"];

const normalizeStatus = (status) => {
  const value = String(status || "").toLowerCase();
  if (VALID_STATUSES.includes(value)) return value;
  if (value === "open" || value === "in_review") return "pending";
  if (value === "resolved") return "approved";
  if (value === "closed") return "rejected";
  return "pending";
};

const formatTicket = (ticket) => {
  const user = ticket.user;
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
  };
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

    ticket.status = status;
    await ticket.save();

    const user = ticket.user;
    if (user?.email) {
      try {
        await sendSupportStatusUpdateEmail({
          to: user.email,
          userName: user.username || user.name,
          status,
        });
      } catch (emailError) {
        console.error("Support status email failed:", emailError.message);
      }
    }

    return res.status(200).json({
      success: true,
      ticket: formatTicket(ticket),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};
