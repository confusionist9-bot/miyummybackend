const mongoose = require("mongoose");

const AddonSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    price: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema(
  {
    // stable key for API + android
    slug: { type: String, required: true, unique: true, index: true },

    // display fields
    name: { type: String, required: true },
    description: { type: String, default: "" },

    status: { type: String, enum: ["available", "unavailable"], default: "available" },

    // prices per size
    prices: {
      oz12: { type: Number, default: 0, min: 0 },
      oz16: { type: Number, default: 0, min: 0 }
    },

    addons: {
      pearls: { type: AddonSchema, default: () => ({ enabled: true, price: 5 }) },
      graham: { type: AddonSchema, default: () => ({ enabled: true, price: 5 }) },
      mangobits: { type: AddonSchema, default: () => ({ enabled: true, price: 10 }) }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", ProductSchema);
