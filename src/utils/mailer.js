const nodemailer = require("nodemailer");

function buildTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP env vars missing. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env"
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 true, 587 false
    auth: { user, pass }
  });
}

async function sendOtpEmail(toEmail, otp) {
  const transporter = buildTransport();
  await transporter.verify();

  const from = process.env.MAIL_FROM || process.env.SMTP_USER;

  const subject = "MiYummy Password Reset Code";
  const text =
    `Your verification code is: ${otp}\n\n` +
    `This code expires in 5 minutes.\n\n` +
    `If you did not request this, you can ignore this email.`;

  return transporter.sendMail({
    from,
    to: toEmail,
    subject,
    text
  });
}

// ✅ NEW: Registration OTP email
async function sendRegisterOtpEmail(toEmail, otp) {
  const transporter = buildTransport();
  await transporter.verify();

  const from = process.env.MAIL_FROM || process.env.SMTP_USER;

  const subject = "MiYummy Registration Code";
  const text =
    `Your registration code is: ${otp}\n\n` +
    `This code expires in 5 minutes.\n\n` +
    `If you did not request this, you can ignore this email.`;

  return transporter.sendMail({
    from,
    to: toEmail,
    subject,
    text
  });
}

module.exports = { sendOtpEmail, sendRegisterOtpEmail };
