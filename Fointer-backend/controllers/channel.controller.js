import Channel from "../models/channel.js";
import { sendServerError } from "../utils/safeError.js";
import { escapeRegex } from "../utils/validate.js";

const formatChannel = (channel) => ({
  id: channel._id,
  name: channel.name,
  createdAt: channel.createdAt,
  updatedAt: channel.updatedAt,
});

export const createChannel = async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Channel name is required.",
      });
    }

    const nameNormalized = name.toLowerCase();
    const existing = await Channel.findOne({ nameNormalized });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A channel with this name already exists.",
      });
    }

    const channel = await Channel.create({ name, nameNormalized });
    return res.status(201).json({
      success: true,
      channel: formatChannel(channel),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A channel with this name already exists.",
      });
    }
    return sendServerError(res, error);
  }
};

export const listChannels = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const filter = {};
    if (q) {
      const escaped = escapeRegex(q);
      filter.name = new RegExp(escaped, "i");
    }

    const channels = await Channel.find(filter).sort({ name: 1 });
    return res.status(200).json({
      success: true,
      channels: channels.map(formatChannel),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};
