const express = require("express");
const User = require("../models/User");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

const router = express.Router();

/**
 * ✅ ADMIN: GET /admin/users
 * Protected (must be logged in + admin)
 * Returns safe user fields only.
 */
router.get("/users", auth, admin, async (req, res) => {
  try {
    const users = await User.find()
      .select("firstName lastName email username mobile isAdmin createdAt")
      .sort({ createdAt: -1 });

    return res.json(users);
  } catch (e) {
    console.error("❌ GET /admin/users error:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * ✅ ADMIN: DELETE /admin/users/:id
 * Protected (must be logged in + admin)
 */
router.delete("/users/:id", auth, admin, async (req, res) => {
  try {
    const { id } = req.params;

    // prevent deleting yourself (optional but safer)
    if (String(req.userId) === String(id)) {
      return res.status(400).json({ message: "You cannot delete your own admin account." });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // prevent deleting other admins (optional but safer)
    if (user.isAdmin) {
      return res.status(403).json({ message: "Cannot delete an admin account." });
    }

    await User.findByIdAndDelete(id);

    return res.json({ success: true, message: "User deleted" });
  } catch (e) {
    console.error("❌ DELETE /admin/users/:id error:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

module.exports = router;
