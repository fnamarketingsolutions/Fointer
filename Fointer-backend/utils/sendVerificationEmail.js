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

const sendVerificationEmail = async ({ to, name, otp }) => {
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
        <p>Thanks for signing up for Fointer. Please use this 6-digit OTP to verify your account.</p>
        <div style="margin:24px 0; padding:16px; background:#fff7e6; border:1px solid #f8a201; border-radius:12px; text-align:center;">
          <div style="font-size:12px; letter-spacing:0.24em; text-transform:uppercase; color:#8a5a00; margin-bottom:8px;">
            Your Verification Code
          </div>
          <div style="font-size:32px; font-weight:700; letter-spacing:0.35em; color:#130d08;">
            ${otp}
          </div>
        </div>
        <p>This OTP expires in 10 minutes.</p>
      </div>
    `,
  });
};

export default sendVerificationEmail;
