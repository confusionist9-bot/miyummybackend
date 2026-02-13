// src/mailer.js
const { Resend } = require("resend");

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY in Render Environment");
  return new Resend(key);
}

function getFrom() {
  // Resend requires a verified domain OR you can use their testing domain depending on account.
  // Put your verified sender here.
  return process.env.MAIL_FROM || "MiYummy <onboarding@resend.dev>";
}

async function sendOtpEmail(toEmail, otp) {
  const resend = getResend();

  const subject = "MiYummy Password Reset Code";
  const text =
    `Your verification code is: ${otp}\n\n` +
    `This code expires in 5 minutes.\n\n` +
    `If you did not request this, you can ignore this email.`;

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
    `Your registration code is: ${otp}\n\n` +
    `This code expires in 5 minutes.\n\n` +
    `If you did not request this, you can ignore this email.`;

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
