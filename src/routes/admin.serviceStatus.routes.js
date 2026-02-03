const express = require("express");
const router = express.Router();
const ServiceStatus = require("../models/ServiceStatus");

// GET current status
router.get("/service-status", async (req, res) => {
  try {
    let doc = await ServiceStatus.findOne({ key: "serviceStatus" });

    // create default if missing
    if (!doc) {
      doc = await ServiceStatus.create({ key: "serviceStatus", status: "active" });
    }

    return res.json({ success: true, status: doc.status });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// PATCH update status
router.patch("/service-status", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const doc = await ServiceStatus.findOneAndUpdate(
      { key: "serviceStatus" },
      { status },
      { new: true, upsert: true }
    );

    return res.json({ success: true, status: doc.status });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
