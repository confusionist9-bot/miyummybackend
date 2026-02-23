// src/routes/auth.routes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const RegisterOtp = require("../models/RegisterOtp");
const { sendRegisterOtpEmail } = require("../mailer");
// const { sendOtpSmsInfobip } = require("../infobipSms");

const router = express.Router();

// ✅ 6-digit OTP
function gen6DigitOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ✅ PH number -> E.164 (+63...)
function normalizePHToE164(mobile) {
  const raw = String(mobile || "").trim();

  if (raw.startsWith("+63") && raw.length === 13) return raw;
  if (raw.startsWith("63") && raw.length === 12) return "+" + raw;
  if (raw.startsWith("09") && raw.length === 11) return "+63" + raw.slice(1);
  if (raw.startsWith("9") && raw.length === 10) return "+63" + raw;

  return null;
}

function maskPhone(e164) {
  const digits = e164.replace("+", "");
  if (digits.length < 12) return e164;
  const last2 = digits.slice(-2);
  return "+63 9** *** **" + last2;
}

/**
 * ✅ POST /auth/register-send-otp   (EMAIL OTP)
 * body: { email }
 */
router.post("/register-send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: "email is required" });

    const emailLower = String(email).toLowerCase().trim();

    // block if already registered
    const existing = await User.findOne({ email: emailLower });
    if (existing) {
      return res.status(400).json({ message: "Email already registered." });
    }

    // ✅ 6-digit OTP
    const otp = gen6DigitOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    // ✅ IMPORTANT: include email in update so upsert stores it
    await RegisterOtp.findOneAndUpdate(
      { email: emailLower },
      { email: emailLower, otpHash, expiresAt, phoneE164: undefined },
      { upsert: true, new: true }
    );

    await sendRegisterOtpEmail(emailLower, otp);

    return res.json({ success: true, message: "OTP sent" });
  } catch (e) {
    console.error("REGISTER SEND OTP ERROR:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * ✅ POST /auth/register-verify-otp   (EMAIL OTP)
 * body: { email, otp }
 * returns: { registerOtpToken }
 */
router.post("/register-verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "email and otp are required" });
    }

    // ✅ 6 digits only
    if (!/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({ message: "OTP must be 6 digits" });
    }

    const emailLower = String(email).toLowerCase().trim();
    const rec = await RegisterOtp.findOne({ email: emailLower });

    if (!rec) return res.status(400).json({ message: "OTP not found. Resend code." });
    if (rec.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP expired. Resend code." });
    }

    const ok = await bcrypt.compare(String(otp), rec.otpHash);
    if (!ok) return res.status(400).json({ message: "Invalid OTP" });

    const registerOtpToken = jwt.sign(
      { email: emailLower, purpose: "register" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    return res.json({
      success: true,
      message: "OTP verified",
      registerOtpToken
    });
  } catch (e) {
    console.error("REGISTER VERIFY OTP ERROR:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * ✅ POST /auth/register-send-sms-otp   (SMS OTP via INFOBIP)
 * body: { mobile }
 */
router.post("/register-send-sms-otp", async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) return res.status(400).json({ message: "mobile is required" });

    const phoneE164 = normalizePHToE164(mobile);
    if (!phoneE164) return res.status(400).json({ message: "Invalid PH mobile number" });

    // ✅ 6-digit OTP
    const otp = gen6DigitOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    // ✅ FIX: include phoneE164 in update so upsert stores it
    await RegisterOtp.findOneAndUpdate(
      { phoneE164 },
      { phoneE164, otpHash, expiresAt, email: undefined },
      { upsert: true, new: true }
    );

    const baseUrl = process.env.INFOBIP_BASE_URL; // xxxxx.api.infobip.com
    const apiKey = process.env.INFOBIP_API_KEY;
    const sender = process.env.INFOBIP_SENDER || "ServiceSMS";

    if (!baseUrl || !apiKey) {
      return res.status(500).json({ message: "Missing Infobip credentials" });
    }

    await sendOtpSmsInfobip({
      baseUrl,
      apiKey,
      toE164: phoneE164,
      from: sender,
      text: `MiYummy OTP: ${otp} (valid 5 minutes)`
    });

    return res.json({
      success: true,
      message: "OTP sent",
      destination: maskPhone(phoneE164)
    });
  } catch (e) {
    console.error("REGISTER SEND SMS OTP ERROR:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * ✅ POST /auth/register-verify-sms-otp
 * body: { mobile, otp }
 * returns: { registerOtpToken }
 */
router.post("/register-verify-sms-otp", async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({ message: "mobile and otp are required" });
    }

    // ✅ 6 digits only
    if (!/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({ message: "OTP must be 6 digits" });
    }

    const phoneE164 = normalizePHToE164(mobile);
    if (!phoneE164) return res.status(400).json({ message: "Invalid PH mobile number" });

    const rec = await RegisterOtp.findOne({ phoneE164 });

    if (!rec) return res.status(400).json({ message: "OTP not found. Resend code." });
    if (rec.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP expired. Resend code." });
    }

    const ok = await bcrypt.compare(String(otp), rec.otpHash);
    if (!ok) return res.status(400).json({ message: "Invalid OTP" });

    const registerOtpToken = jwt.sign(
      { phoneE164, purpose: "register_sms" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    return res.json({
      success: true,
      message: "OTP verified",
      registerOtpToken
    });
  } catch (e) {
    console.error("REGISTER VERIFY SMS OTP ERROR:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * ✅ POST /auth/register
 * body: { firstName, lastName, username, email, mobile, password, registerOtpToken }
 */
router.post("/register", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      username,
      email,
      mobile,
      password,
      registerOtpToken
    } = req.body;

    if (!registerOtpToken) {
      return res.status(400).json({ message: "Missing registerOtpToken" });
    }

    let payload;
    try {
      payload = jwt.verify(registerOtpToken, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(400).json({ message: "Invalid/expired OTP token" });
    }

    if (payload.purpose !== "register" && payload.purpose !== "register_sms") {
      return res.status(400).json({ message: "Invalid OTP token purpose" });
    }

    if (!firstName || !lastName || !username || !email || !mobile || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const usernameTrim = String(username).trim();
    const emailLower = String(email).toLowerCase().trim();
    const pass = String(password);

    const phoneE164 = normalizePHToE164(mobile);
    if (!phoneE164) return res.status(400).json({ message: "Invalid PH mobile number" });

    if (payload.purpose === "register" && emailLower !== payload.email) {
      return res.status(400).json({ message: "Email does not match OTP verification." });
    }
    if (payload.purpose === "register_sms" && phoneE164 !== payload.phoneE164) {
      return res.status(400).json({ message: "Mobile does not match OTP verification." });
    }

    if (pass.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const exists = await User.findOne({
      $or: [{ username: usernameTrim }, { email: emailLower }]
    });

    if (exists) {
      return res.status(400).json({ message: "Username or email already exists." });
    }

    const passwordHash = await bcrypt.hash(pass, 10);

    const user = await User.create({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      username: usernameTrim,
      email: emailLower,
      mobile: phoneE164,
      passwordHash,
      isAdmin: false,
      cart: [],
      addresses: []
    });

    await RegisterOtp.deleteOne(
      payload.purpose === "register_sms"
        ? { phoneE164 }
        : { email: emailLower }
    );

    return res.status(201).json({
      success: true,
      message: "Registered successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        isAdmin: !!user.isAdmin
      }
    });
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * ✅ POST /auth/login
 * body: { identifier, password }
 */
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: "identifier and password are required." });
    }

    const ident = String(identifier).trim();
    const pass = String(password);

    const isEmail = ident.includes("@");
    const query = isEmail ? { email: ident.toLowerCase() } : { username: ident };

    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ message: "Invalid credentials." });

    const ok = await bcrypt.compare(pass, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials." });

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
        isAdmin: !!user.isAdmin
      }
    });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * ✅ POST /auth/admin-login
 */
router.post("/admin-login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: "identifier and password are required." });
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

    const token = jwt.sign(
      { userId: user._id, isAdmin: true },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      token,
      admin: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: true
      }
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

    const { firstName, lastName, username, email, mobile, password } = req.body;

    if (!firstName || !lastName || !username || !email || !mobile || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const usernameTrim = String(username).trim();
    const emailLower = String(email).toLowerCase().trim();

    const exists = await User.findOne({
      $or: [{ username: usernameTrim }, { email: emailLower }]
    });
    if (exists) {
      return res.status(400).json({ message: "Username or email already exists." });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const admin = await User.create({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      username: usernameTrim,
      email: emailLower,
      mobile: String(mobile).trim(),
      passwordHash,
      isAdmin: true,
      cart: [],
      addresses: []
    });

    return res.status(201).json({
      message: "Admin created",
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        isAdmin: admin.isAdmin
      }
    });
  } catch (e) {
    console.error("CREATE ADMIN ERROR:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

module.exports = router;
