// src/routes/auth.routes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const { sendOtpEmail } = require("../utils/mailer");

const router = express.Router();

// Helper: create 4-digit OTP
function generateOtp4() {
  return Math.floor(1000 + Math.random() * 9000).toString(); // 1000-9999
}

/**
 * POST /auth/register
 * body: { firstName,lastName,username,email,password,mobile }
 */
router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, username, email, password, mobile } = req.body;

    if (!firstName || !lastName || !username || !email || !password || !mobile) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const emailLower = email.toLowerCase();

    const existingEmail = await User.findOne({ email: emailLower });
    if (existingEmail) return res.status(409).json({ message: "Email already exists." });

    const existingUsername = await User.findOne({ username });
    if (existingUsername) return res.status(409).json({ message: "Username already exists." });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      firstName,
      lastName,
      username,
      email: emailLower,
      mobile,
      passwordHash,
      cart: [],
      addresses: []
    });

    return res.status(201).json({
      message: "Registered",
      userId: user._id
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * POST /auth/login
 * body: { identifier, password }
 * identifier can be username OR email
 */
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: "identifier and password are required." });
    }

    const isEmail = identifier.includes("@");
    const query = isEmail
      ? { email: identifier.toLowerCase() }
      : { username: identifier };

    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ message: "Invalid credentials." });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials." });

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        cart: user.cart,
        addresses: user.addresses
      }
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * ✅ POST /auth/forgot-password
 * body: { email }
 * Sends OTP to email + saves hashed OTP with expiration
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Email is required." });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Email not found." });

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    // ✅ Try sending first
    try {
      await sendOtpEmail(email, otp);
    } catch (mailErr) {
      console.error("❌ OTP Email failed:", mailErr);
      return res.status(500).json({ message: "Failed to send code. Check email config." });
    }

    // ✅ Save only if email was sent successfully
    user.resetOtpHash = otpHash;
    user.resetOtpExpires = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    return res.json({ message: "OTP sent to email." });
  } catch (e) {
    console.error("❌ forgot-password error:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * ✅ POST /auth/verify-otp
 * body: { email, otp }
 */
router.post("/verify-otp", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const user = await User.findOne({ email });
    if (!user || !user.resetOtpHash || !user.resetOtpExpires) {
      return res.status(400).json({ message: "Invalid request." });
    }

    if (user.resetOtpExpires.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP expired." });
    }

    const ok = await bcrypt.compare(otp, user.resetOtpHash);
    if (!ok) return res.status(400).json({ message: "Incorrect OTP." });

    return res.json({ message: "OTP verified." });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * ✅ POST /auth/reset-password
 * body: { email, otp, newPassword }
 * Verifies OTP again then resets password
 */
router.post("/reset-password", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();
    const newPassword = String(req.body.newPassword || "");

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "email, otp, newPassword are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const user = await User.findOne({ email });
    if (!user || !user.resetOtpHash || !user.resetOtpExpires) {
      return res.status(400).json({ message: "Invalid request." });
    }

    if (user.resetOtpExpires.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP expired." });
    }

    const ok = await bcrypt.compare(otp, user.resetOtpHash);
    if (!ok) return res.status(400).json({ message: "Incorrect OTP." });

    user.passwordHash = await bcrypt.hash(newPassword, 10);

    // ✅ clear OTP so it cannot be reused
    user.resetOtpHash = null;
    user.resetOtpExpires = null;

    await user.save();

    return res.json({ message: "Password reset successful." });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

module.exports = router;
