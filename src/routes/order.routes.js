const express = require("express");
const User = require("../models/User");
const Order = require("../models/Order");
const auth = require("../middleware/auth");

const router = express.Router();

function genOrderNumber() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${yyyy}${mm}${dd}-${rand}`;
}

async function makeUniqueOrderNumber() {
  for (let i = 0; i < 5; i++) {
    const candidate = genOrderNumber();
    const exists = await Order.exists({ orderNumber: candidate });
    if (!exists) return candidate;
  }
  return `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * POST /orders
 * Place order using USER CART; clears cart
 */
router.post("/", auth, async (req, res) => {
  try {
    const { paymentMethod, shippingFee = 0 } = req.body;
    if (!paymentMethod) return res.status(400).json({ message: "paymentMethod required" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.cart.length) return res.status(400).json({ message: "Cart is empty" });

    const defaultAddr = user.addresses.find(a => a.isDefault) || user.addresses[0];
    if (!defaultAddr) return res.status(400).json({ message: "No saved address" });

    const subtotal = user.cart.reduce((sum, i) => sum + Number(i.totalPrice || 0), 0);
    const total = subtotal + Number(shippingFee || 0);

    const orderNumber = await makeUniqueOrderNumber();

    const order = await Order.create({
      userId: user._id,
      orderNumber,
      items: user.cart.map(i => ({
        productName: i.productName,
        size: i.size,
        addons: i.addons,
        quantity: i.quantity,
        totalPrice: i.totalPrice,
        imageKey: i.imageKey
      })),
      paymentMethod,
      orderDate: Date.now(),
      status: "Processing",
      subtotal,
      shippingFee: Number(shippingFee || 0),
      total,
      deliveryAddressSnapshot: {
        fullname: defaultAddr.fullname,
        number: defaultAddr.number,
        barangay: defaultAddr.barangay,
        landmark: defaultAddr.landmark
      }
    });

    user.cart = [];
    await user.save();

    return res.status(201).json({
      message: "Order placed",
      orderId: order._id,
      orderNumber: order.orderNumber
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * POST /orders/direct
 * Place order from items body; does NOT touch cart
 */
router.post("/direct", auth, async (req, res) => {
  try {
    const { paymentMethod, shippingFee = 0, items } = req.body;

    if (!paymentMethod) return res.status(400).json({ message: "paymentMethod required" });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "items required" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const defaultAddr = user.addresses.find(a => a.isDefault) || user.addresses[0];
    if (!defaultAddr) return res.status(400).json({ message: "No saved address" });

    const safeItems = items.map(i => ({
      productName: String(i.productName || ""),
      size: String(i.size || ""),
      addons: String(i.addons || ""),
      quantity: Number(i.quantity || 0),
      totalPrice: Number(i.totalPrice || 0),
      imageKey: String(i.imageKey || "")
    }));

    if (safeItems.some(i => !i.productName || !i.size || i.quantity < 1 || i.totalPrice < 0)) {
      return res.status(400).json({ message: "Invalid items" });
    }

    const subtotal = safeItems.reduce((sum, i) => sum + i.totalPrice, 0);
    const total = subtotal + Number(shippingFee || 0);

    const orderNumber = await makeUniqueOrderNumber();

    const order = await Order.create({
      userId: user._id,
      orderNumber,
      items: safeItems,
      paymentMethod,
      orderDate: Date.now(),
      status: "Processing",
      subtotal,
      shippingFee: Number(shippingFee || 0),
      total,
      deliveryAddressSnapshot: {
        fullname: defaultAddr.fullname,
        number: defaultAddr.number,
        barangay: defaultAddr.barangay,
        landmark: defaultAddr.landmark
      }
    });

    return res.status(201).json({
      message: "Order placed",
      orderId: order._id,
      orderNumber: order.orderNumber
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * GET /orders
 * User sees own orders (HIDE userReceived=true)
 */
router.get("/", auth, async (req, res) => {
  try {
    const orders = await Order.find({
      userId: req.userId,
      userReceived: { $ne: true } // ✅ hide after Order received
    }).sort({ createdAt: -1 });

    return res.json(orders);
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});


/**
 * PATCH /orders/:orderId/cancel
 * Only allowed when status is Processing
 */
router.patch("/:orderId/cancel", auth, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ _id: orderId, userId: req.userId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status !== "Processing") {
      return res.status(400).json({ message: "You can only cancel while Processing" });
    }

    order.status = "Cancelled";
    await order.save();

    return res.json({ message: "Order cancelled", orderId: order._id, status: order.status });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * PATCH /orders/:orderId/address
 * Only allowed when status is Processing
 */
router.patch("/:orderId/address", auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { fullname, number, barangay, landmark } = req.body;

    const order = await Order.findOne({ _id: orderId, userId: req.userId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status !== "Processing") {
      return res.status(400).json({ message: "You can only change address while Processing" });
    }

    if (!fullname || !number || !barangay) {
      return res.status(400).json({ message: "fullname, number, barangay are required" });
    }

    order.deliveryAddressSnapshot = {
      fullname,
      number,
      barangay,
      landmark: landmark || ""
    };

    await order.save();

    return res.json({
      message: "Address updated",
      orderId: order._id,
      deliveryAddressSnapshot: order.deliveryAddressSnapshot
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * ✅ PATCH /orders/:orderId/received
 * Only allowed when status is Delivered
 * Marks order as customer-received (hide from history + count in sales)
 */
router.patch("/:orderId/received", auth, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ _id: orderId, userId: req.userId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status !== "Delivered") {
      return res.status(400).json({ message: "Order must be Delivered before receiving." });
    }

    order.userReceived = true;
    order.receivedAt = Date.now();
    await order.save();

    return res.json({ message: "Order received confirmed", orderId: order._id });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

module.exports = router;
