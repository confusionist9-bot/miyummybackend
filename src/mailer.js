const nodemailer = require("nodemailer");

function buildTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  console.log("SMTP_HOST:", host ? "OK" : "MISSING");
  console.log("SMTP_PORT:", port);
  console.log("SMTP_USER:", user ? "OK" : "MISSING");
  console.log("SMTP_PASS:", pass ? `OK (len=${String(pass).length})` : "MISSING");

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP env vars missing. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in Render Environment"
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

async function sendOtpEmail(toEmail, otp) {
  try {
    const transporter = buildTransport();
    await transporter.verify();

    const from = process.env.MAIL_FROM || process.env.SMTP_USER;

    const subject = "MiYummy Password Reset Code";
    const text =
      `Your verification code is: ${otp}\n\n` +
      `This code expires in 5 minutes.\n\n` +
      `If you did not request this, you can ignore this email.`;

    console.log("📨 Sending RESET OTP to:", toEmail);
    const info = await transporter.sendMail({ from, to: toEmail, subject, text });
    console.log("✅ RESET OTP sent:", info.messageId);
    return info;
  } catch (err) {
    console.error("❌ sendOtpEmail error:", err);
    throw err;
  }
}

async function sendRegisterOtpEmail(toEmail, otp) {
  try {
    const transporter = buildTransport();
    await transporter.verify();

    const from = process.env.MAIL_FROM || process.env.SMTP_USER;

    const subject = "MiYummy Registration Code";
    const text =
      `Your registration code is: ${otp}\n\n` +
      `This code expires in 5 minutes.\n\n` +
      `If you did not request this, you can ignore this email.`;

    console.log("📨 Sending REGISTER OTP to:", toEmail);
    const info = await transporter.sendMail({ from, to: toEmail, subject, text });
    console.log("✅ REGISTER OTP sent:", info.messageId);
    return info;
  } catch (err) {
    console.error("❌ sendRegisterOtpEmail error:", err);
    throw err;
  }
}

module.exports = { sendOtpEmail, sendRegisterOtpEmail };
