const express = require("express");
const User = require("../models/User");

const router = express.Router();

/**
 * ✅ PUBLIC: GET /admin/users
 * Anyone can access this (no token).
 * Returns safe user fields only.
 */
router.get("/users", async (req, res) => {
  try {
    const users = await User.find()
      .select("firstName lastName email username mobile createdAt")
      .sort({ createdAt: -1 });

    return res.json(users);
  } catch (e) {
    console.error("❌ /admin/users error:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

module.exports = router;
