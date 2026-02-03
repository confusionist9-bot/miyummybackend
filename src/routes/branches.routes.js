const express = require("express");
const Branch = require("../models/Branch");

const router = express.Router();

// GET /branches
router.get("/", async (req, res) => {
  try {
    const branches = await Branch.find().sort({ createdAt: -1 });
    return res.json(branches);
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

module.exports = router;
