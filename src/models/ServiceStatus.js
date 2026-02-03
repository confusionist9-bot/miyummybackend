const mongoose = require("mongoose");

const ServiceStatusSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // always "serviceStatus"
    status: { type: String, enum: ["active", "inactive"], default: "active" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ServiceStatus", ServiceStatusSchema);
