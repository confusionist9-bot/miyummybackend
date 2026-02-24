// src/routes/auth.routes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const mongoose = require("mongoose");

// Models
const User = require("../models/User");

// ✅ Resend mailer (Forgot password email OTP)
const { sendOtpEmail } = require("../mailer"); // adjust path if your mailer.js is in another folder

const router = express.Router();

/**
 * ===========================
 * ENV FLAGS
 * ===========================
 * REQUIRE_PHONE_OTP:
 *  - true  => Register requires phone OTP verification via TextBee (recommended)
 *  - false => Register does NOT require OTP
 */
const REQUIRE_PHONE_OTP =
  String(process.env.REQUIRE_PHONE_OTP || "true").toLowerCase() === "true";

/**
 * TextBee envs:
 *  - TEXTBEE_API_KEY
 *  - TEXTBEE_DEVICE_ID
 */
const TEXTBEE_API_KEY = process.env.TEXTBEE_API_KEY;
const TEXTBEE_DEVICE_ID = process.env.TEXTBEE_DEVICE_ID;

/**
 * ===========================
 * PHONE NORMALIZER (PH -> E.164)
 * ===========================
 */
function normalizePHToE164(mobile) {
  const raw = String(mobile || "").trim();
  if (!raw) return null;

  if (raw.startsWith("+63") && raw.length === 13) return raw;
  if (raw.startsWith("63") && raw.length === 12) return "+" + raw;
  if (raw.startsWith("09") && raw.length === 11) return "+63" + raw.slice(1);
  if (raw.startsWith("9") && raw.length === 10) return "+63" + raw;

  return null;
}

function missingFields(obj, fields) {
  const missing = [];
  for (const f of fields) {
    if (!obj[f] || String(obj[f]).trim() === "") missing.push(f);
  }
  return missing;
}

/* ===========================
   OTP HELPERS (Forgot Password - EMAIL)
   =========================== */
function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

function generateOtp4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/* ===========================
   OTP HELPERS (REGISTER - PHONE via TextBee)
   =========================== */
function generateOtp6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ✅ Simple fetch fallback for older Node (Node 18+ has global fetch)
async function doFetch(url, options) {
  if (typeof fetch === "function") return fetch(url, options);
  // fallback if needed:
  // npm i node-fetch
  const fetchFn = (await import("node-fetch")).default;
  return fetchFn(url, options);
}

async function sendSmsViaTextBee(toE164, message) {
  if (!TEXTBEE_API_KEY || !TEXTBEE_DEVICE_ID) {
    throw new Error("Missing TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID in environment.");
  }

  const url = `https://api.textbee.dev/api/v1/gateway/devices/${TEXTBEE_DEVICE_ID}/send-sms`;

  const res = await doFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": TEXTBEE_API_KEY,
    },
    body: JSON.stringify({
      recipients: [toE164],
      message,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`TextBee send failed (${res.status}): ${raw}`);
  }

  return true;
}

/**
 * ===========================
 * Phone OTP Mongo Model (inline)
 * ===========================
 * This avoids creating a separate file.
 * TTL index auto deletes expired OTP docs.
 */
const PhoneOtpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true }, // E.164
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    used: { type: Boolean, default: false, index: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// TTL index: delete when expiresAt is reached
PhoneOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PhoneOtp =
  mongoose.models.PhoneOtp || mongoose.model("PhoneOtp", PhoneOtpSchema);

/**
 * ✅ POST /auth/request-phone-otp
 * body: { mobile }
 * Sends OTP SMS using TextBee (for REGISTER)
 */
router.post("/request-phone-otp", async (req, res) => {
  try {
    const { mobile } = req.body || {};
    const phoneE164 = normalizePHToE164(mobile);

    if (!phoneE164) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid PH mobile number. Use 09xxxxxxxxx / 9xxxxxxxxx / 63xxxxxxxxxx / +63xxxxxxxxxx",
      });
    }

    // Optional: prevent sending OTP if number already registered
    const exists = await User.findOne({ mobile: phoneE164 });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Mobile already exists.",
      });
    }

    const otp = generateOtp6();
    const otpHash = await bcrypt.hash(otp, 10);

    // invalidate previous OTPs for this phone
    await PhoneOtp.updateMany(
      { phone: phoneE164, used: false },
      { $set: { used: true } }
    );

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await PhoneOtp.create({
      phone: phoneE164,
      otpHash,
      expiresAt,
      used: false,
      attempts: 0,
    });

    await sendSmsViaTextBee(
      phoneE164,
      `MiYummy OTP: ${otp} (valid for 5 minutes)`
    );

    return res.json({
      success: true,
      message: "OTP sent via SMS.",
    });
  } catch (e) {
    console.error("REQUEST PHONE OTP ERROR:", e);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP.",
      error: e.message,
    });
  }
});

/**
 * ✅ POST /auth/verify-phone-otp
 * body: { mobile, otp }
 * Verifies SMS OTP then returns a short-lived phoneOtpToken
 */
router.post("/verify-phone-otp", async (req, res) => {
  try {
    const { mobile, otp } = req.body || {};
    const phoneE164 = normalizePHToE164(mobile);
    const otpStr = String(otp || "").trim();

    if (!phoneE164 || !otpStr) {
      return res.status(400).json({
        success: false,
        message: "mobile and otp are required.",
      });
    }

    const record = await PhoneOtp.findOne({
      phone: phoneE164,
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: "Incorrect or expired verification code",
      });
    }

    if (record.attempts >= 5) {
      record.used = true;
      await record.save();
      return res.status(429).json({
        success: false,
        message: "Too many attempts. Request a new code.",
      });
    }

    const ok = await bcrypt.compare(otpStr, record.otpHash);
    record.attempts += 1;

    if (!ok) {
      await record.save();
      return res.status(400).json({
        success: false,
        message: "Incorrect or expired verification code",
      });
    }

    // mark as used
    record.used = true;
    await record.save();

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Missing JWT_SECRET in environment.",
      });
    }

    // short-lived token used only for REGISTER
    const phoneOtpToken = jwt.sign(
      { purpose: "register_phone_otp", phone: phoneE164 },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    return res.json({
      success: true,
      message: "OTP verified.",
      phoneOtpToken,
      phone: phoneE164,
    });
  } catch (e) {
    console.error("VERIFY PHONE OTP ERROR:", e);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: e.message,
    });
  }
});

/**
 * ✅ POST /auth/register
 * Now uses TextBee OTP token instead of Firebase token (when REQUIRE_PHONE_OTP=true)
 *
 * Expect body:
 * { firstName,lastName,username,email,password,mobile, phoneOtpToken }
 */
router.post("/register", async (req, res) => {
  try {
    const body = req.body || {};

    const firstName = body.firstName;
    const lastName = body.lastName;
    const username = body.username;
    const email = body.email;
    const password = body.password;

    const mobileRaw = body.mobile ?? body.phone ?? body.phoneNumber;
    const phoneOtpToken = body.phoneOtpToken;

    const required = ["firstName", "lastName", "username", "email", "password"];
    const missing = missingFields(
      { firstName, lastName, username, email, password },
      required
    );

    if (!mobileRaw || String(mobileRaw).trim() === "") missing.push("mobile");

    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields.",
        missing,
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const phoneE164 = normalizePHToE164(mobileRaw);
    if (!phoneE164) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid PH mobile number. Use 09xxxxxxxxx / 9xxxxxxxxx / 63xxxxxxxxxx / +63xxxxxxxxxx",
      });
    }

    // ✅ Require SMS OTP verification for register (TextBee)
    if (REQUIRE_PHONE_OTP) {
      if (!phoneOtpToken) {
        return res.status(400).json({
          success: false,
          message: "Missing phoneOtpToken (required). Verify phone OTP first.",
        });
      }

      if (!process.env.JWT_SECRET) {
        return res.status(500).json({
          success: false,
          message: "Missing JWT_SECRET in environment.",
        });
      }

      let decoded;
      try {
        decoded = jwt.verify(phoneOtpToken, process.env.JWT_SECRET);
      } catch (e) {
        return res.status(401).json({
          success: false,
          message: "Invalid/expired phoneOtpToken. Please verify OTP again.",
        });
      }

      if (decoded.purpose !== "register_phone_otp" || !decoded.phone) {
        return res.status(401).json({
          success: false,
          message: "Invalid phoneOtpToken payload.",
        });
      }

      if (decoded.phone !== phoneE164) {
        return res.status(400).json({
          success: false,
          message: "Mobile number does not match the verified phone.",
          expected: decoded.phone,
          received: phoneE164,
        });
      }
    }

    const usernameTrim = String(username).trim();
    const emailLower = String(email).toLowerCase().trim();

    const exists = await User.findOne({
      $or: [
        { username: usernameTrim },
        { email: emailLower },
        { mobile: phoneE164 },
      ],
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Username, email, or mobile already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const user = await User.create({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      username: usernameTrim,
      email: emailLower,
      mobile: phoneE164,
      passwordHash,
      isAdmin: false,
      cart: [],
      addresses: [],
    });

    if (!process.env.JWT_SECRET) {
      return res
        .status(500)
        .json({ success: false, message: "Missing JWT_SECRET in environment." });
    }

    const token = jwt.sign(
      { userId: user._id, isAdmin: !!user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      success: true,
      message: "Registered successfully",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        isAdmin: !!user.isAdmin,
      },
    });
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: e.message,
    });
  }
});

/**
 * ✅ POST /auth/login
 */
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: "identifier and password are required." });
    }

    const ident = String(identifier).trim();
    const pass = String(password);

    const isEmail = ident.includes("@");
    const query = isEmail ? { email: ident.toLowerCase() } : { username: ident };

    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ message: "Invalid credentials." });

    const ok = await bcrypt.compare(pass, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials." });

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Missing JWT_SECRET in environment." });
    }

    const token = jwt.sign(
      { userId: user._id, isAdmin: !!user.isAdmin },
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
        isAdmin: !!user.isAdmin,
      },
    });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * ✅ POST /auth/forgot-password
 * body: { email }
 * Sends OTP to email via Resend (mailer.js)
 *
 * Requires User schema fields:
 * - resetOtpHash: String
 * - resetOtpExpiresAt: Date
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    const emailLower = String(email || "").toLowerCase().trim();

    if (!emailLower) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required." });
    }

    const user = await User.findOne({ email: emailLower });
    if (!user) {
      return res.status(404).json({ success: false, message: "Email not found." });
    }

    const otp = generateOtp4();

    user.resetOtpHash = sha256(otp);
    user.resetOtpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
    await user.save();

    await sendOtpEmail(user.email, otp);

    return res.json({
      success: true,
      message: "Code sent. Please check your email.",
    });
  } catch (e) {
    console.error("FORGOT PASSWORD ERROR:", e);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: e.message });
  }
});

/**
 * ✅ POST /auth/verify-otp
 * body: { email, otp }
 * For Forgot_pass2.kt (EMAIL OTP)
 */
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    const emailLower = String(email || "").toLowerCase().trim();
    const otpStr = String(otp || "").trim();

    if (!emailLower || !otpStr) {
      return res
        .status(400)
        .json({ success: false, message: "Email and OTP required." });
    }

    const user = await User.findOne({ email: emailLower });
    if (!user) {
      return res.status(404).json({ success: false, message: "Email not found." });
    }

    if (!user.resetOtpHash || !user.resetOtpExpiresAt) {
      return res.status(400).json({ success: false, message: "No OTP requested." });
    }

    if (Date.now() > user.resetOtpExpiresAt.getTime()) {
      return res
        .status(400)
        .json({ success: false, message: "Incorrect or expired verification code" });
    }

    if (sha256(otpStr) !== user.resetOtpHash) {
      return res
        .status(400)
        .json({ success: false, message: "Incorrect or expired verification code" });
    }

    return res.json({ success: true, message: "OTP verified." });
  } catch (e) {
    console.error("VERIFY OTP ERROR:", e);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: e.message });
  }
});

/**
 * ✅ POST /auth/reset-password
 * body: { email, otp, newPassword }
 * For Forgot_pass3.kt
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body || {};
    const emailLower = String(email || "").toLowerCase().trim();
    const otpStr = String(otp || "").trim();

    if (!emailLower || !otpStr || !newPassword) {
      return res.status(400).json({ success: false, message: "Missing fields." });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const user = await User.findOne({ email: emailLower });
    if (!user) {
      return res.status(404).json({ success: false, message: "Email not found." });
    }

    if (
      !user.resetOtpHash ||
      !user.resetOtpExpiresAt ||
      Date.now() > user.resetOtpExpiresAt.getTime() ||
      sha256(otpStr) !== user.resetOtpHash
    ) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP." });
    }

    user.passwordHash = await bcrypt.hash(String(newPassword), 10);
    user.resetOtpHash = null;
    user.resetOtpExpiresAt = null;
    await user.save();

    return res.json({ success: true, message: "Password reset successful." });
  } catch (e) {
    console.error("RESET PASSWORD ERROR:", e);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: e.message });
  }
});

/**
 * ✅ POST /auth/admin-login
 */
router.post("/admin-login", async (req, res) => {
  try {
    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: "identifier and password are required." });
    }

    const ident = String(identifier).trim();
    const pass = String(password);

    const isEmail = ident.includes("@");
    const query = isEmail ? { email: ident.toLowerCase() } : { username: ident };

    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ message: "Invalid credentials." });

    const ok = await bcrypt.compare(pass, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials." });

    if (!user.isAdmin) {
      return res.status(403).json({ message: "Admin only." });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Missing JWT_SECRET in environment." });
    }

    const token = jwt.sign({ userId: user._id, isAdmin: true }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({
      success: true,
      token,
      admin: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: true,
      },
    });
  } catch (e) {
    console.error("ADMIN LOGIN ERROR:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * ✅ POST /auth/create-admin
 */
router.post("/create-admin", async (req, res) => {
  try {
    const setupKey = String(req.headers["x-admin-setup-key"] || "");
    if (!process.env.ADMIN_SETUP_KEY || setupKey !== process.env.ADMIN_SETUP_KEY) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { firstName, lastName, username, email, mobile, password } = req.body || {};

    if (!firstName || !lastName || !username || !email || !mobile || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const usernameTrim = String(username).trim();
    const emailLower = String(email).toLowerCase().trim();

    const exists = await User.findOne({
      $or: [{ username: usernameTrim }, { email: emailLower }],
    });
    if (exists) {
      return res.status(400).json({ message: "Username or email already exists." });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const adminUser = await User.create({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      username: usernameTrim,
      email: emailLower,
      mobile: String(mobile).trim(),
      passwordHash,
      isAdmin: true,
      cart: [],
      addresses: [],
    });

    return res.status(201).json({
      message: "Admin created",
      admin: {
        id: adminUser._id,
        username: adminUser.username,
        email: adminUser.email,
        isAdmin: adminUser.isAdmin,
      },
    });
  } catch (e) {
    console.error("CREATE ADMIN ERROR:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

module.exports = router;