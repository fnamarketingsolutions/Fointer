import mongoose from "mongoose";
import Channel from "../models/channel.js";
import Subchannel from "../models/subchannel.js";
import Community from "../models/community.js";
import { sendServerError } from "../utils/safeError.js";
import { escapeRegex } from "../utils/validate.js";

const formatSubchannel = (subchannel) => {
  const channel = subchannel.channel;
  const channelId =
    channel && typeof channel === "object" && channel._id
      ? channel._id
      : subchannel.channel;

  return {
    id: subchannel._id,
    name: subchannel.name,
    channel:
      channel && typeof channel === "object" && channel._id
        ? { id: channel._id, name: channel.name }
        : { id: channelId },
    channelId,
    createdAt: subchannel.createdAt,
    updatedAt: subchannel.updatedAt,
  };
};

export const createSubchannel = async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const channelId = String(req.body?.channelId || req.body?.channel || "").trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Subchannel name is required.",
      });
    }

    if (!channelId || !mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).json({
        success: false,
        message: "A valid parent channel is required.",
      });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Parent channel not found.",
      });
    }

    const nameNormalized = name.toLowerCase();
    const existing = await Subchannel.findOne({
      channel: channelId,
      nameNormalized,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A subchannel with this name already exists in the selected channel.",
      });
    }

    const subchannel = await Subchannel.create({
      name,
      nameNormalized,
      channel: channelId,
    });

    await subchannel.populate("channel", "name");

    return res.status(201).json({
      success: true,
      subchannel: formatSubchannel(subchannel),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A subchannel with this name already exists in the selected channel.",
      });
    }
    return sendServerError(res, error);
  }
};

export const listSubchannels = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const channelId = String(req.query.channelId || "").trim();
    const filter = {};

    if (channelId) {
      if (!mongoose.Types.ObjectId.isValid(channelId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid channel id.",
        });
      }
      filter.channel = channelId;
    }

    if (q) {
      filter.name = new RegExp(escapeRegex(q), "i");
    }

    const subchannels = await Subchannel.find(filter)
      .populate("channel", "name")
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      subchannels: subchannels.map(formatSubchannel),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const updateSubchannel = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subchannel id.",
      });
    }

    const subchannel = await Subchannel.findById(id);
    if (!subchannel) {
      return res.status(404).json({
        success: false,
        message: "Subchannel not found.",
      });
    }

    const name = req.body?.name !== undefined ? String(req.body.name).trim() : subchannel.name;
    const channelId = req.body?.channelId || req.body?.channel !== undefined
      ? String(req.body.channelId || req.body.channel).trim()
      : String(subchannel.channel);

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Subchannel name cannot be empty.",
      });
    }

    if (!channelId || !mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).json({
        success: false,
        message: "A valid parent channel is required.",
      });
    }

    const oldChannelId = String(subchannel.channel);
    const parentChanging = oldChannelId !== channelId;
    const oldParent = await Channel.findById(oldChannelId).select("name");
    const oldParentName = oldParent?.name || "";
    const oldName = subchannel.name;

    if (parentChanging) {
      const channelExists = await Channel.findById(channelId);
      if (!channelExists) {
        return res.status(404).json({
          success: false,
          message: "Parent channel not found.",
        });
      }

      if (oldParentName) {
        const inUse = await Community.countDocuments({
          channel: new RegExp(`^${escapeRegex(oldParentName)}$`, "i"),
          subchannels: new RegExp(`^${escapeRegex(oldName)}$`, "i"),
        });
        if (inUse > 0) {
          return res.status(400).json({
            success: false,
            message:
              "This subchannel is used by existing communities. Rename it in place, or move those communities first.",
          });
        }
      }
    }

    const nameNormalized = name.toLowerCase();

    const duplicate = await Subchannel.findOne({
      _id: { $ne: id },
      channel: channelId,
      nameNormalized,
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "A subchannel with this name already exists in the selected channel.",
      });
    }

    subchannel.name = name;
    subchannel.nameNormalized = nameNormalized;
    subchannel.channel = channelId;

    await subchannel.save();
    await subchannel.populate("channel", "name");

    if (!parentChanging && oldParentName && oldName !== name) {
      await Community.updateMany(
        {
          channel: new RegExp(`^${escapeRegex(oldParentName)}$`, "i"),
          subchannels: new RegExp(`^${escapeRegex(oldName)}$`, "i"),
        },
        { $set: { "subchannels.$[elem]": name } },
        {
          arrayFilters: [
            { elem: new RegExp(`^${escapeRegex(oldName)}$`, "i") },
          ],
        }
      );
    }

    return res.status(200).json({
      success: true,
      subchannel: formatSubchannel(subchannel),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A subchannel with this name already exists in the selected channel.",
      });
    }
    return sendServerError(res, error);
  }
};
