// src/mailer.js
const { Resend } = require("resend");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

function getResend() {
  return new Resend(requireEnv("RESEND_API_KEY"));
}

function getFrom() {
  // Works without domain verification using resend testing sender
  // (some accounts require verification for custom domains)
  return process.env.MAIL_FROM || "MiYummy <onboarding@resend.dev>";
}

async function sendOtpEmail(toEmail, otp) {
  const resend = getResend();

  const subject = "MiYummy Password Reset Code";
  const text =
    `Your MiYummy password reset code is: ${otp}\n\n` +
    `This code expires in 5 minutes.\n\n` +
    `If you did not request this, ignore this email.`;

  console.log("📨 Sending RESET OTP via Resend to:", toEmail);

  const result = await resend.emails.send({
    from: getFrom(),
    to: toEmail,
    subject,
    text
  });

  console.log("✅ RESET OTP sent via Resend:", result?.data?.id || result);
  return result;
}

async function sendRegisterOtpEmail(toEmail, otp) {
  const resend = getResend();

  const subject = "MiYummy Registration Code";
  const text =
    `Your MiYummy registration code is: ${otp}\n\n` +
    `This code expires in 5 minutes.\n\n` +
    `If you did not request this, ignore this email.`;

  console.log("📨 Sending REGISTER OTP via Resend to:", toEmail);

  const result = await resend.emails.send({
    from: getFrom(),
    to: toEmail,
    subject,
    text
  });

  console.log("✅ REGISTER OTP sent via Resend:", result?.data?.id || result);
  return result;
}

module.exports = { sendOtpEmail, sendRegisterOtpEmail };