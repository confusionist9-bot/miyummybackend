import mongoose from "mongoose";

const OtpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true }, // E.164, ex: +639xxxxxxxxx
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0 },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// TTL index so expired docs auto-delete
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Otp", OtpSchema);