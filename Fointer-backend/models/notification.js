import mongoose from "mongoose";

export const NOTIFICATION_TYPES = [
  "join_request",
  "join_request_approved",
  "join_request_denied",
  "invite",
  "invite_accepted",
  "invite_declined",
  "comment",
  "reply",
  "like",
  "reshare",
  "mention",
  "moderator_assigned",
  "moderator_revoked",
  "member_removed",
  "member_banned",
  "member_unbanned",
  "support_ticket",
];

export const SYSTEM_NOTIFICATION_TYPES = [
  "join_request",
  "join_request_approved",
  "join_request_denied",
  "invite",
  "invite_accepted",
  "invite_declined",
  "moderator_assigned",
  "moderator_revoked",
  "member_removed",
  "member_banned",
  "member_unbanned",
  "support_ticket",
];

export const ENTITY_KINDS = [
  "post",
  "comment",
  "community",
  "join_request",
  "invite",
  "support_ticket",
];

const actorSnapshotSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    username: { type: String, default: "" },
    name: { type: String, default: "" },
    avatar: { type: String, default: "" },
  },
  { _id: false }
);

const communitySnapshotSchema = new mongoose.Schema(
  {
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: "Community" },
    name: { type: String, default: "" },
    shortCode: { type: String, default: "" },
  },
  { _id: false }
);

const entitySnapshotSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ENTITY_KINDS },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    shortCode: { type: String, default: "" },
    title: { type: String, default: "" },
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actor: {
      type: actorSnapshotSchema,
      default: null,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
    body: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    entity: {
      type: entitySnapshotSchema,
      default: null,
    },
    community: {
      type: communitySnapshotSchema,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({
  recipient: 1,
  type: 1,
  "actor.userId": 1,
  "entity.kind": 1,
  "entity.targetId": 1,
  readAt: 1,
});

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
