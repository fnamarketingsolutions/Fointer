import nodemailer from "nodemailer";

const createTransporter = () => {
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

const sendVerificationEmail = async ({ to, name, verificationUrl }) => {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const transporter = createTransporter();

  await transporter.sendMail({
    from,
    to,
    subject: "Verify your Fointer account",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2 style="margin-bottom: 16px;">Verify your email</h2>
        <p>Hi ${name || "there"},</p>
        <p>Thanks for signing up for Fointer. Please confirm your email address to activate your account.</p>
        <p style="margin: 24px 0;">
          <a
            href="${verificationUrl}"
            style="background:#f8a201;color:#130d08;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;"
          >
            Verify Email
          </a>
        </p>
        <p>If the button does not work, open this link:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>This link expires in 24 hours.</p>
      </div>
    `,
  });
};

export default sendVerificationEmail;
