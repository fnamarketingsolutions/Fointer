import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import {
  getPublicAdminUrl,
  getPublicFrontendUrl,
} from "./publicAppUrls.js";

let sesClient = null;

const getSesRegion = () =>
  String(process.env.SES_REGION || process.env.AWS_REGION || "").trim();

const getSesClient = () => {
  if (sesClient) return sesClient;
  const region = getSesRegion();
  const accessKeyId = String(process.env.AWS_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.AWS_SECRET_ACCESS_KEY || "").trim();
  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "SES is not configured. Set AWS_REGION (or SES_REGION), AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY."
    );
  }
  sesClient = new SESClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
  return sesClient;
};

const getFromAddress = () => {
  const from = String(process.env.EMAIL_FROM || "").trim();
  if (!from) {
    throw new Error(
      "EMAIL_FROM is missing. Set a verified SES sender address (e.g. noreply@fointer.net)."
    );
  }
  return from;
};

/** Admin inbox for support tickets (falls back to EMAIL_FROM). */
const getSupportInbox = () =>
  String(process.env.EMAIL_SUPPORT_TO || process.env.EMAIL_FROM || "").trim();

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const stripHtml = (html) =>
  String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const sendRawEmail = async ({ to, subject, html }) => {
  if (!to) {
    throw new Error("Recipient email is missing.");
  }
  const from = getFromAddress();
  const text = stripHtml(html);

  await getSesClient().send(
    new SendEmailCommand({
      Source: from,
      Destination: {
        ToAddresses: [String(to).trim()],
      },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: html, Charset: "UTF-8" },
          Text: { Data: text || subject, Charset: "UTF-8" },
        },
      },
    })
  );
};

const frontendBase = () => getPublicFrontendUrl();

const communityPathSegment = (community) => {
  if (!community) return "";
  if (typeof community === "object") {
    return community.shortCode || community._id || community.id || "";
  }
  return String(community);
};

export const getCommunitiesInvitesUrl = () =>
  `${frontendBase()}/communities?tab=invites`;

export const getCommunitiesRequestsUrl = () =>
  `${frontendBase()}/communities?tab=requests`;

export const getCommunitiesUrl = (community) => {
  const segment = communityPathSegment(community);
  return segment
    ? `${frontendBase()}/communities/${encodeURIComponent(segment)}`
    : `${frontendBase()}/communities`;
};

export const getManageCommunityIncomingUrl = (community) => {
  const segment = communityPathSegment(community);
  return segment
    ? `${frontendBase()}/communities/manage/${encodeURIComponent(segment)}?section=incoming`
    : `${frontendBase()}/communities/manage`;
};

export const getManageCommunityMembersUrl = (community) => {
  const segment = communityPathSegment(community);
  return segment
    ? `${frontendBase()}/communities/manage/${encodeURIComponent(segment)}?section=members`
    : `${frontendBase()}/communities/manage`;
};

const getSupportUserUrl = () => `${frontendBase()}/support`;

const getSupportAdminUrl = () => `${frontendBase()}/admin/support`;

const adminBase = () => getPublicAdminUrl();

const getUserSupportAdminUrl = () => `${adminBase()}/usersupport`;

/**
 * Shared dashboard notification email used by join-request and invite flows.
 */
const sendDashboardNotificationEmail = async ({
  to,
  subject,
  title,
  greetingName,
  bodyHtml,
  ctaLabel = "View join requests",
  actionUrl,
}) => {
  if (!to) {
    throw new Error("Recipient email is missing.");
  }

  const safeGreeting = escapeHtml(greetingName) || "there";
  const safeTitle = escapeHtml(title);
  const safeUrl = escapeHtml(actionUrl || getManageCommunityIncomingUrl());
  const safeCta = escapeHtml(ctaLabel);

  await sendRawEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2 style="margin-bottom: 16px;">${safeTitle}</h2>
        <p>Hi ${safeGreeting},</p>
        ${bodyHtml}
        <p style="margin: 24px 0;">
          <a
            href="${safeUrl}"
            style="display:inline-block;padding:12px 20px;background:#f8a201;color:#130d08;text-decoration:none;border-radius:8px;font-weight:600;"
          >
            ${safeCta}
          </a>
        </p>
        <p style="font-size:12px;color:#6b7280;">
          Or open this link: <a href="${safeUrl}">${safeUrl}</a>
        </p>
      </div>
    `,
  });
};

const sendVerificationEmail = async ({ to, name, otp }) => {
  await sendRawEmail({
    to,
    subject: "Verify your Fointer account",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2 style="margin-bottom: 16px;">Verify your email</h2>
        <p>Hi ${escapeHtml(name) || "there"},</p>
        <p>Thanks for signing up for Fointer. Please use this 6-digit OTP to verify your account.</p>
        <div style="margin:24px 0; padding:16px; background:#fff7e6; border:1px solid #f8a201; border-radius:12px; text-align:center;">
          <div style="font-size:12px; letter-spacing:0.24em; text-transform:uppercase; color:#8a5a00; margin-bottom:8px;">
            Your Verification Code
          </div>
          <div style="font-size:32px; font-weight:700; letter-spacing:0.35em; color:#130d08;">
            ${escapeHtml(otp)}
          </div>
        </div>
        <p>This OTP expires in 10 minutes.</p>
      </div>
    `,
  });
};

export const sendJoinRequestReceivedEmail = async ({
  to,
  ownerName,
  requesterName,
  communityName,
  actionUrl,
}) => {
  const safeRequester = escapeHtml(requesterName) || "A user";
  const safeCommunity = escapeHtml(communityName) || "your community";

  await sendDashboardNotificationEmail({
    to,
    subject: `New join request for ${communityName || "your community"}`,
    title: "New community join request",
    greetingName: ownerName,
    bodyHtml: `
      <p>
        <strong>${safeRequester}</strong> has requested to join
        <strong>${safeCommunity}</strong>.
      </p>
      <p>Review and approve or deny this request from your dashboard.</p>
    `,
    actionUrl,
  });
};

export const sendJoinRequestApprovedEmail = async ({
  to,
  userName,
  communityName,
  actionUrl,
}) => {
  const safeCommunity = escapeHtml(communityName) || "the community";

  await sendDashboardNotificationEmail({
    to,
    subject: `Your join request for ${communityName || "the community"} was approved`,
    title: "Join request approved",
    greetingName: userName,
    bodyHtml: `
      <p>
        Your request to join <strong>${safeCommunity}</strong> has been approved.
        You are now a member.
      </p>
    `,
    actionUrl,
  });
};

export const sendJoinRequestDeniedEmail = async ({
  to,
  userName,
  communityName,
  actionUrl,
}) => {
  const safeCommunity = escapeHtml(communityName) || "the community";

  await sendDashboardNotificationEmail({
    to,
    subject: `Your join request for ${communityName || "the community"} was rejected`,
    title: "Join request rejected",
    greetingName: userName,
    bodyHtml: `
      <p>
        Your request to join <strong>${safeCommunity}</strong> has been rejected.
      </p>
    `,
    actionUrl,
  });
};

export const sendCommunityInviteEmail = async ({
  to,
  inviteeName,
  inviterName,
  communityName,
  actionUrl,
}) => {
  const safeInviter = escapeHtml(inviterName) || "A community owner";
  const safeCommunity = escapeHtml(communityName) || "a community";

  await sendDashboardNotificationEmail({
    to,
    subject: `You're invited to join ${communityName || "a community"}`,
    title: "Community invite",
    greetingName: inviteeName,
    bodyHtml: `
      <p>
        <strong>${safeInviter}</strong> invited you to join
        <strong>${safeCommunity}</strong>.
      </p>
      <p>Accept or decline this invite from your dashboard.</p>
    `,
    ctaLabel: "View invites",
    actionUrl,
  });
};

export const sendCommunityInviteAcceptedEmail = async ({
  to,
  recipientName,
  inviteeName,
  communityName,
  actionUrl,
}) => {
  const safeInvitee = escapeHtml(inviteeName) || "A user";
  const safeCommunity = escapeHtml(communityName) || "your community";

  await sendDashboardNotificationEmail({
    to,
    subject: `${inviteeName || "A user"} accepted your invite to ${communityName || "your community"}`,
    title: "Invite accepted",
    greetingName: recipientName,
    bodyHtml: `
      <p>
        <strong>${safeInvitee}</strong> accepted your invite to join
        <strong>${safeCommunity}</strong>.
      </p>
    `,
    ctaLabel: "View invites",
    actionUrl,
  });
};

export const sendCommunityInviteDeclinedEmail = async ({
  to,
  recipientName,
  inviteeName,
  communityName,
  actionUrl,
}) => {
  const safeInvitee = escapeHtml(inviteeName) || "A user";
  const safeCommunity = escapeHtml(communityName) || "your community";

  await sendDashboardNotificationEmail({
    to,
    subject: `${inviteeName || "A user"} declined your invite to ${communityName || "your community"}`,
    title: "Invite declined",
    greetingName: recipientName,
    bodyHtml: `
      <p>
        <strong>${safeInvitee}</strong> declined your invite to join
        <strong>${safeCommunity}</strong>.
      </p>
    `,
    ctaLabel: "View invites",
    actionUrl,
  });
};

const SUPPORT_REQUEST_INTRO =
  "A member is requesting a channel and subchannel. If they need additional channels or subchannels, their details are in the message below. Please review and respond from the admin dashboard.";

export const sendSupportRequestEmail = async ({ userName, description }) => {
  const to = getSupportInbox();
  if (!to) {
    throw new Error(
      "Support recipient email is missing (EMAIL_SUPPORT_TO / EMAIL_FROM)."
    );
  }

  const safeName = escapeHtml(userName) || "A user";
  const safeDescription = escapeHtml(description).replace(/\n/g, "<br/>");
  const adminUrl = escapeHtml(getSupportAdminUrl());

  await sendRawEmail({
    to,
    subject: "New support request",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px;">
        <h2 style="margin-bottom: 16px; color: #130d08;">New support request</h2>
        <p style="margin: 0 0 16px; color: #4b5563;">${SUPPORT_REQUEST_INTRO}</p>
        <p style="margin: 0 0 8px;"><strong>From:</strong> ${safeName}</p>
        <p style="margin: 0 0 8px;"><strong>Message:</strong></p>
        <div style="margin: 0 0 24px; padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; color: #374151;">
          ${safeDescription}
        </div>
        <p style="margin: 0 0 8px;">
          <a
            href="${adminUrl}"
            style="display: inline-block; padding: 12px 20px; background: #f8a201; color: #130d08; text-decoration: none; border-radius: 8px; font-weight: 600;"
          >
            See help support
          </a>
        </p>
        <p style="font-size: 12px; color: #6b7280; margin-top: 16px;">
          Or open this link: <a href="${adminUrl}">${adminUrl}</a>
        </p>
      </div>
    `,
  });
};

export const sendUserSupportRequestEmail = async ({
  email,
  phone,
  categoryName,
  message,
}) => {
  const to = getSupportInbox();
  if (!to) {
    throw new Error(
      "Support recipient email is missing (EMAIL_SUPPORT_TO / EMAIL_FROM)."
    );
  }

  const adminUrl = escapeHtml(getUserSupportAdminUrl());
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone);
  const safeCategory = escapeHtml(categoryName);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br/>");

  await sendRawEmail({
    to,
    subject: "New user support request",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px;">
        <h2 style="margin-bottom: 16px; color: #130d08;">New user support request</h2>
        <p style="margin: 0 0 8px;"><strong>Category:</strong> ${safeCategory}</p>
        <p style="margin: 0 0 8px;"><strong>Email:</strong> ${safeEmail}</p>
        <p style="margin: 0 0 8px;"><strong>Phone:</strong> ${safePhone}</p>
        <p style="margin: 0 0 8px;"><strong>Message:</strong></p>
        <div style="margin: 0 0 24px; padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; color: #374151;">
          ${safeMessage}
        </div>
        <p style="margin: 0 0 8px;">
          <a
            href="${adminUrl}"
            style="display: inline-block; padding: 12px 20px; background: #f8a201; color: #130d08; text-decoration: none; border-radius: 8px; font-weight: 600;"
          >
            Open User Support Management
          </a>
        </p>
        <p style="font-size: 12px; color: #6b7280; margin-top: 16px;">
          Or open this link: <a href="${adminUrl}">${adminUrl}</a>
        </p>
      </div>
    `,
  });
};

const getSupportStatusCopy = (
  status,
  { channelName = "", subchannelName = "", rejectionReason = "" } = {}
) => {
  if (status === "approved") {
    const created =
      channelName && subchannelName
        ? ` ${escapeHtml(channelName)} / ${escapeHtml(subchannelName)} is now available when you create a community.`
        : "";
    return {
      title: "Support request approved",
      subject: "Your channel request was approved",
      body: `Your channel and subchannel request has been approved and created.${created}`,
      ctaLabel: "View support status",
      statusLabel: "Created",
    };
  }

  if (status === "rejected") {
    const reason = String(rejectionReason || "").trim();
    return {
      title: "Support request rejected",
      subject: "Your channel request was rejected",
      body: `Your channel and subchannel request has been reviewed and rejected.${reason ? ` Reason: ${escapeHtml(reason)}` : ""} You can view the updated status on your support page.`,
      ctaLabel: "View support status",
      statusLabel: "Rejected",
    };
  }

  return {
    title: "Support request received",
    subject: "Your channel request is pending review",
    body: "Your channel and subchannel request has been received and is pending review. We will notify you when an admin updates the status.",
    ctaLabel: "View support status",
    statusLabel: "Pending",
  };
};

export const sendSupportStatusUpdateEmail = async ({
  to,
  userName,
  status,
  channelName,
  subchannelName,
  rejectionReason,
}) => {
  if (!to) {
    throw new Error("Recipient email is missing.");
  }

  const copy = getSupportStatusCopy(status, {
    channelName,
    subchannelName,
    rejectionReason,
  });
  const safeStatus = escapeHtml(copy.statusLabel);

  await sendDashboardNotificationEmail({
    to,
    subject: copy.subject,
    title: copy.title,
    greetingName: userName,
    bodyHtml: `
      <p>${copy.body}</p>
      <p><strong>Status:</strong> ${safeStatus}</p>
    `,
    ctaLabel: copy.ctaLabel,
    actionUrl: getSupportUserUrl(),
  });
};

export default sendVerificationEmail;
