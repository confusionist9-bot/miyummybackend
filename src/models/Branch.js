const mongoose = require("mongoose");

const BranchSchema = new mongoose.Schema(
  {
    branchLocation: { type: String, required: true },
    branchDescription: { type: String, required: true },
    openTime: { type: String, required: true },  // "09:00"
    closeTime: { type: String, required: true }, // "21:00"
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Branch", BranchSchema);
