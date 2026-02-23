// src/routes/auth.routes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");

const User = require("../models/User");

const router = express.Router();

/**
 * ✅ Config
 * REQUIRE_FIREBASE_PHONE:
 *  - "true"  => require firebaseIdToken + phone match (recommended for production)
 *  - "false" => allow register without firebase (useful for dev/testing)
 */
const REQUIRE_FIREBASE_PHONE = String(process.env.REQUIRE_FIREBASE_PHONE || "true").toLowerCase() === "true";

/**
 * ✅ Firebase Admin init (ONE TIME)
 * Put your service account JSON (string) in env FIREBASE_SERVICE_ACCOUNT_JSON
 */
function initFirebaseAdmin() {
  if (admin.apps.length) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.warn("⚠️ Missing FIREBASE_SERVICE_ACCOUNT_JSON in env. Firebase Admin not initialized.");
    return;
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (e) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON:", e);
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin initialized");
  } catch (e) {
    console.error("❌ Firebase Admin initializeApp failed:", e);
  }
}
initFirebaseAdmin();

// ✅ PH number -> E.164 (+63...)
function normalizePHToE164(mobile) {
  const raw = String(mobile || "").trim();

  if (!raw) return null;

  // already +63xxxxxxxxxx (13 chars: +63 + 10 digits)
  if (raw.startsWith("+63") && raw.length === 13) return raw;

  // 63xxxxxxxxxx (12 chars)
  if (raw.startsWith("63") && raw.length === 12) return "+" + raw;

  // 09xxxxxxxxx (11 chars)
  if (raw.startsWith("09") && raw.length === 11) return "+63" + raw.slice(1);

  // 9xxxxxxxxx (10 chars)
  if (raw.startsWith("9") && raw.length === 10) return "+63" + raw;

  return null;
}

// ✅ helper: respond missing fields with a clear list
function missingFields(obj, fields) {
  const missing = [];
  for (const f of fields) {
    if (!obj[f] || String(obj[f]).trim() === "") missing.push(f);
  }
  return missing;
}

/**
 * ✅ POST /auth/register
 * body:
 * {
 *   firstName, lastName, username, email,
 *   mobile (or phone/phoneNumber), password,
 *   firebaseIdToken
 * }
 */
router.post("/register", async (req, res) => {
  try {
    // accept common phone key variants from Android/frontend
    const body = req.body || {};

    const firstName = body.firstName;
    const lastName = body.lastName;
    const username = body.username;
    const email = body.email;
    const password = body.password;

    // mobile can come from: mobile / phone / phoneNumber
    const mobileRaw = body.mobile ?? body.phone ?? body.phoneNumber;
    const firebaseIdToken = body.firebaseIdToken;

    // ✅ validate required fields (always required)
    const required = ["firstName", "lastName", "username", "email", "password"];
    const missing = missingFields(
      { firstName, lastName, username, email, password },
      required
    );

    // mobile is always required in YOUR database schema logic
    // but we validate it separately to show a better message
    if (!mobileRaw || String(mobileRaw).trim() === "") missing.push("mobile");

    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields.",
        missing, // ✅ makes debugging super easy on Android
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    // ✅ Normalize PH mobile to E.164
    const phoneE164 = normalizePHToE164(mobileRaw);
    if (!phoneE164) {
      return res.status(400).json({
        success: false,
        message: "Invalid PH mobile number. Use 09xxxxxxxxx / 9xxxxxxxxx / 63xxxxxxxxxx / +63xxxxxxxxxx",
      });
    }

    // ✅ Firebase requirement (default ON)
    if (REQUIRE_FIREBASE_PHONE) {
      if (!firebaseIdToken) {
        return res.status(400).json({
          success: false,
          message: "Missing firebaseIdToken (required).",
        });
      }

      if (!admin.apps.length) {
        return res.status(500).json({
          success: false,
          message: "Firebase Admin not initialized. Check FIREBASE_SERVICE_ACCOUNT_JSON.",
        });
      }

      let decoded;
      try {
        decoded = await admin.auth().verifyIdToken(firebaseIdToken);
      } catch (e) {
        return res.status(401).json({
          success: false,
          message: "Invalid/expired Firebase token",
        });
      }

      const firebasePhone = decoded.phone_number; // ex: +639xxxxxxxxx
      if (!firebasePhone) {
        return res.status(400).json({
          success: false,
          message: "Firebase token has no phone_number. Make sure user signed in via phone OTP.",
        });
      }

      if (phoneE164 !== firebasePhone) {
        return res.status(400).json({
          success: false,
          message: "Mobile number does not match the verified Firebase phone number.",
          expected: firebasePhone,
          received: phoneE164,
        });
      }
    }

    const usernameTrim = String(username).trim();
    const emailLower = String(email).toLowerCase().trim();

    // ✅ Prevent duplicates (username/email/mobile)
    const exists = await User.findOne({
      $or: [{ username: usernameTrim }, { email: emailLower }, { mobile: phoneE164 }],
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
 * body: { identifier, password }
 */
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body || {};

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
 * ✅ POST /auth/admin-login
 */
router.post("/admin-login", async (req, res) => {
  try {
    const { identifier, password } = req.body || {};

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

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Missing JWT_SECRET in environment." });
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