const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const RegisterOtp = require("../models/RegisterOtp"); // ✅ NEW
const { sendRegisterOtpEmail } = require("../mailer"); // ✅ NEW

const router = express.Router();

function gen4DigitOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * ✅ POST /auth/register-send-otp
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

    const otp = gen4DigitOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    await RegisterOtp.findOneAndUpdate(
      { email: emailLower },
      { otpHash, expiresAt },
      { upsert: true, new: true }
    );

    await sendRegisterOtpEmail(emailLower, otp);

    return res.json({ success: true, message: "OTP sent" });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * ✅ POST /auth/register-verify-otp
 * body: { email, otp }
 * returns: { registerOtpToken }
 */
router.post("/register-verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "email and otp are required" });
    }

    const emailLower = String(email).toLowerCase().trim();
    const rec = await RegisterOtp.findOne({ email: emailLower });

    if (!rec) return res.status(400).json({ message: "OTP not found. Resend code." });
    if (rec.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP expired. Resend code." });
    }

    const ok = await bcrypt.compare(String(otp), rec.otpHash);
    if (!ok) return res.status(400).json({ message: "Invalid OTP" });

    // ✅ short-lived token proving email ownership
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
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * =========================
 * POST /auth/register
 * body: { firstName, lastName, username, email, mobile, password, registerOtpToken }
 * =========================
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
      registerOtpToken // ✅ REQUIRED NOW
    } = req.body;

    if (!registerOtpToken) {
      return res.status(400).json({ message: "Missing registerOtpToken" });
    }

    // ✅ verify OTP token
    let payload;
    try {
      payload = jwt.verify(registerOtpToken, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(400).json({ message: "Invalid/expired OTP token" });
    }

    if (payload.purpose !== "register") {
      return res.status(400).json({ message: "Invalid OTP token purpose" });
    }

    if (!firstName || !lastName || !username || !email || !mobile || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const usernameTrim = String(username).trim();
    const emailLower = String(email).toLowerCase().trim();
    const pass = String(password);

    // ✅ must match verified email
    if (emailLower !== payload.email) {
      return res.status(400).json({ message: "Email does not match OTP verification." });
    }

    if (pass.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    // prevent duplicates
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
      mobile: String(mobile).trim(),
      passwordHash,
      isAdmin: false,
      cart: [],
      addresses: []
    });

    // cleanup
    await RegisterOtp.deleteOne({ email: emailLower });

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
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * =========================
 * POST /auth/login
 * body: { identifier, password }
 * =========================
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
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * =========================
 * POST /auth/admin-login
 * body: { identifier, password }
 * requires isAdmin === true
 * =========================
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

    const token = jwt.sign({ userId: user._id, isAdmin: true }, process.env.JWT_SECRET, {
      expiresIn: "7d"
    });

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
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * =========================
 * POST /auth/create-admin
 * headers: x-admin-setup-key
 * body: { firstName, lastName, username, email, mobile, password }
 * =========================
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
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

module.exports = router;
