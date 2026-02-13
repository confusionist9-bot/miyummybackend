const express = require("express");
const User = require("../models/User");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

const router = express.Router();

/**
 * ✅ GET /admin/users
 * Admin only
 */
router.get("/users", auth, admin, async (req, res) => {
  try {
    const users = await User.find()
      .select("firstName lastName email username mobile isBanned createdAt")
      .sort({ createdAt: -1 });

    return res.json(users);
  } catch (e) {
    console.error("❌ /admin/users error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ✅ PATCH /admin/users/:id/ban
 * Toggle ban/unban
 */
router.patch("/users/:id/ban", auth, admin, async (req, res) => {
  try {
    const userId = String(req.params.id || "").trim();
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    // (optional safety) prevent banning admins
    if (user.isAdmin) {
      return res.status(400).json({ message: "You cannot ban an admin account." });
    }

    user.isBanned = !user.isBanned;
    await user.save();

    return res.json({
      message: user.isBanned ? "User banned" : "User unbanned",
      isBanned: user.isBanned
    });
  } catch (e) {
    console.error("❌ /admin/users/:id/ban error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
