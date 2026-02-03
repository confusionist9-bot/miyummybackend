const express = require("express");
const Branch = require("../models/Branch");

const router = express.Router();

// POST /admin/branches
router.post("/branches", async (req, res) => {
  try {
    const { branchLocation, branchDescription, openTime, closeTime, isActive } = req.body;

    if (!branchLocation || !branchDescription || !openTime || !closeTime) {
      return res.status(400).json({
        message: "branchLocation, branchDescription, openTime, closeTime are required",
      });
    }

    const created = await Branch.create({
      branchLocation,
      branchDescription,
      openTime,
      closeTime,
      isActive: isActive !== undefined ? !!isActive : true,
    });

    return res.status(201).json({ message: "Branch created", branch: created });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

// PATCH /admin/branches/:id
router.patch("/branches/:id", async (req, res) => {
  try {
    const updated = await Branch.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Branch not found" });
    return res.json({ message: "Branch updated", branch: updated });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

// DELETE /admin/branches/:id
router.delete("/branches/:id", async (req, res) => {
  try {
    const deleted = await Branch.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Branch not found" });
    return res.json({ message: "Branch deleted" });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

module.exports = router;
