const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true },
    size: { type: String, required: true },
    addons: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    totalPrice: { type: Number, required: true, min: 0 },
    imageKey: { type: String, default: "" }
  },
  { _id: false }
);

const RiderSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    contact: { type: String, default: "" }
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    orderNumber: { type: String, required: true, unique: true },

    items: { type: [OrderItemSchema], required: true },

    paymentMethod: { type: String, required: true },
    orderDate: { type: Number, required: true }, // millis

    status: {
      type: String,
      default: "Processing",
      enum: ["Processing", "Preparing", "Out for Delivery", "Delivered", "Cancelled"]
    },

    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },

    deliveryAddressSnapshot: {
      fullname: String,
      number: String,
      barangay: String,
      landmark: String
    },

    rider: { type: RiderSchema, default: () => ({}) },

    // ✅ NEW: confirms customer pressed "Order received"
    userReceived: { type: Boolean, default: false },
    receivedAt: { type: Number, default: null } // millis
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);
