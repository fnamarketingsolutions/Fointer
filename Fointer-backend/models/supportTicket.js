import mongoose from "mongoose";

const supportTicketSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "rejected", "approved"],
      default: "pending",
    },
    fulfilledChannelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      default: null,
    },
    fulfilledChannelName: {
      type: String,
      default: "",
      trim: true,
    },
    fulfilledSubchannelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subchannel",
      default: null,
    },
    fulfilledSubchannelName: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);

export default SupportTicket;
