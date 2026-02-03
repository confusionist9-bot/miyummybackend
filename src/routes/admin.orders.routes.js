// src/routes/admin.orders.routes.js
const express = require("express");
const Order = require("../models/Order");
const User = require("../models/User");

const router = express.Router();

/**
 * GET /admin/orders?start=...&end=...
 * PUBLIC: Admin sees all orders + username
 * ✅ EXCLUDES Cancelled orders
 * ✅ Optional filter by orderDate range [start, end)
 *
 * start/end are millis (Number)
 */
router.get("/orders", async (req, res) => {
  try {
    const start = req.query.start ? Number(req.query.start) : null;
    const end = req.query.end ? Number(req.query.end) : null;

    const query = { status: { $ne: "Cancelled" } };

    if (Number.isFinite(start) && Number.isFinite(end)) {
      query.orderDate = { $gte: start, $lt: end };
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });

    const userIds = [...new Set(orders.map((o) => String(o.userId)))];
    const users = await User.find({ _id: { $in: userIds } }).select("username");
    const map = new Map(users.map((u) => [String(u._id), u.username]));

    const out = orders.map((o) => ({
      ...o.toObject(),
      username: map.get(String(o.userId)) || "Unknown",
    }));

    return res.json(out);
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * PATCH /admin/orders/:orderId/status
 * PUBLIC: updates status
 * body: { status }
 */
router.patch("/orders/:orderId/status", async (req, res) => {
  try {
    const { orderId } = req.params;
    const status = String(req.body.status || "").trim();

    const allowed = ["Processing", "Preparing", "Out for Delivery", "Delivered", "Cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status === "Delivered" || order.status === "Cancelled") {
      return res.status(400).json({ message: `Cannot change status from ${order.status}` });
    }

    order.status = status;
    await order.save();

    return res.json({ message: "Status updated", orderId: order._id, status: order.status });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * PATCH /admin/orders/:orderId/rider
 * PUBLIC: assigns rider
 * body: { name, contact }
 */
router.patch("/orders/:orderId/rider", async (req, res) => {
  try {
    const { orderId } = req.params;
    const name = String(req.body.name || "").trim();
    const contact = String(req.body.contact || "").trim();

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status !== "Out for Delivery" && order.status !== "Delivered") {
      return res.status(400).json({
        message: "Rider can only be assigned when Out for Delivery / Delivered",
      });
    }

    order.rider = { name, contact };
    await order.save();

    return res.json({ message: "Rider assigned", orderId: order._id, rider: order.rider });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

module.exports = router;
