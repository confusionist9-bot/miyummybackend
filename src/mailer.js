// src/mailer.js
const nodemailer = require("nodemailer");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: false, // true only if using port 465
    auth: {
      user: requireEnv("SMTP_USER"),
      pass: requireEnv("SMTP_PASS") // MUST be Gmail App Password
    }
  });
}

function getFrom() {
  return process.env.MAIL_FROM || `MiYummy <${process.env.SMTP_USER}>`;
}

async function sendOtpEmail(toEmail, otp) {
  const transporter = createTransporter();

  const subject = "MiYummy Password Reset Code";
  const text =
    `Your MiYummy password reset code is: ${otp}\n\n` +
    `This code expires in 5 minutes.\n\n` +
    `If you did not request this, ignore this email.`;

  console.log("📨 Sending RESET OTP to:", toEmail);

  const info = await transporter.sendMail({
    from: getFrom(),
    to: toEmail,
    subject,
    text
  });

  console.log("✅ RESET OTP sent:", info.messageId);
  return info;
}

async function sendRegisterOtpEmail(toEmail, otp) {
  const transporter = createTransporter();

  const subject = "MiYummy Registration Code";
  const text =
    `Your MiYummy registration code is: ${otp}\n\n` +
    `This code expires in 5 minutes.\n\n` +
    `If you did not request this, ignore this email.`;

  console.log("📨 Sending REGISTER OTP to:", toEmail);

  const info = await transporter.sendMail({
    from: getFrom(),
    to: toEmail,
    subject,
    text
  });

  console.log("✅ REGISTER OTP sent:", info.messageId);
  return info;
}

module.exports = { sendOtpEmail, sendRegisterOtpEmail };