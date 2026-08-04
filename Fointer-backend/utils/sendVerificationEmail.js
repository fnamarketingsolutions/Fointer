import nodemailer from "nodemailer";

export const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS."
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
};

const getFromAddress = () => process.env.EMAIL_FROM || process.env.SMTP_USER;

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const getRequestsActionUrl = () => {
  const frontendUrl = String(process.env.FRONTEND_URL || "").replace(/\/$/, "");
  return `${frontendUrl}/dashboard/requests`;
};

/**
 * Shared dashboard notification email used by join-request and invite flows.
 */
export const sendDashboardNotificationEmail = async ({
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

  const from = getFromAddress();
  const transporter = createTransporter();
  const safeGreeting = escapeHtml(greetingName) || "there";
  const safeTitle = escapeHtml(title);
  const safeSubject = subject;
  const safeUrl = escapeHtml(actionUrl || getRequestsActionUrl());
  const safeCta = escapeHtml(ctaLabel);

  await transporter.sendMail({
    from,
    to,
    subject: safeSubject,
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
  const from = getFromAddress();
  const transporter = createTransporter();

  await transporter.sendMail({
    from,
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

export default sendVerificationEmail;
