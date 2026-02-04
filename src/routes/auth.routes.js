const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const router = express.Router();

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
    const query = isEmail
      ? { email: ident.toLowerCase() }
      : { username: ident };

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
    const query = isEmail
      ? { email: ident.toLowerCase() }
      : { username: ident };

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

    const emailLower = String(email).toLowerCase().trim();

    // prevent duplicates
    const exists = await User.findOne({
      $or: [
        { username: String(username).trim() },
        { email: emailLower }
      ]
    });
    if (exists) {
      return res.status(400).json({ message: "Username or email already exists." });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const admin = await User.create({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      username: String(username).trim(),
      email: emailLower,
      mobile: String(mobile).trim(),
      passwordHash,
      isAdmin: true
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
