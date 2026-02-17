const mongoose = require("mongoose");

const RegisterOtpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("RegisterOtp", RegisterOtpSchema);
