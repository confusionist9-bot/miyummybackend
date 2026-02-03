// src/models/User.js
const mongoose = require("mongoose");

const AddressSchema = new mongoose.Schema(
  {
    addressId: String,
    fullname: String,
    number: String,
    barangay: String,
    landmark: String,
    isDefault: Boolean
  },
  { _id: false }
);

const CartItemSchema = new mongoose.Schema(
  {
    cartItemId: String,
    productName: String,
    size: String,
    addons: String,
    quantity: Number,
    totalPrice: Number,
    imageKey: String
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },

    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    mobile: { type: String, required: true },

    passwordHash: { type: String, required: true },

    // ✅ admin flag
    isAdmin: { type: Boolean, default: false },

    cart: { type: [CartItemSchema], default: [] },
    addresses: { type: [AddressSchema], default: [] },

    resetOtpHash: { type: String, default: null },
    resetOtpExpires: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
