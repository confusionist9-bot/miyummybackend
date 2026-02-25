const express = require("express");
const User = require("../models/User");

const router = express.Router();

/**
 * ✅ GET /admin/users
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

/**
 * ✅ DELETE /admin/users/:id
 */
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await User.findByIdAndDelete(id);

    return res.json({ message: "User deleted successfully" });
  } catch (e) {
    console.error("❌ DELETE user error:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

module.exports = router;