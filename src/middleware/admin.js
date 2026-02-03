// src/middleware/admin.js
const User = require("../models/User");

async function admin(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    if (!user.isAdmin) return res.status(403).json({ message: "Admin only" });
    next();
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
}

module.exports = admin;
