const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Product = require("../models/Product"); // ✅ ADD THIS
const auth = require("../middleware/auth");

const router = express.Router();

/**
 * GET /me
 * returns user info + cart + addresses
 */
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * ✅ PATCH /me/profile
 * body: { firstName, lastName, mobile }
 */
router.patch("/profile", auth, async (req, res) => {
  try {
    const { firstName, lastName, mobile } = req.body;

    if (!firstName || !lastName || !mobile) {
      return res.status(400).json({ message: "firstName, lastName, mobile are required" });
    }

    if (!/^\d{11}$/.test(String(mobile))) {
      return res.status(400).json({ message: "Mobile must be 11 digits" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.firstName = firstName;
    user.lastName = lastName;
    user.mobile = mobile;

    await user.save();

    return res.json({
      message: "Profile updated",
      user: {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        mobile: user.mobile
      }
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * ✅ PATCH /me/password
 * body: { oldPassword, newPassword }
 */
router.patch("/password", auth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "oldPassword and newPassword are required" });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ message: "Old password is incorrect" });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ message: "Password updated" });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * POST /me/address
 * body: { fullname, number, barangay, landmark, isDefault }
 */
router.post("/address", auth, async (req, res) => {
  try {
    const { fullname, number, barangay, landmark, isDefault } = req.body;

    if (!fullname || !number || !barangay) {
      return res.status(400).json({ message: "fullname, number, barangay are required" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (isDefault) {
      user.addresses = user.addresses.map((a) => ({ ...a.toObject(), isDefault: false }));
    }

    user.addresses.push({
      addressId: crypto.randomUUID(),
      fullname,
      number,
      barangay,
      landmark: landmark || "",
      isDefault: !!isDefault
    });

    await user.save();
    return res.status(201).json({ message: "Address added", addresses: user.addresses });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * POST /me/cart
 * body: { productName, size, addons, quantity, totalPrice, imageKey }
 */
router.post("/cart", auth, async (req, res) => {
  try {
    const { productName, size, addons, quantity, totalPrice, imageKey } = req.body;

    if (!productName || !size || !quantity || totalPrice === undefined) {
      return res.status(400).json({
        message: "productName, size, quantity, totalPrice are required"
      });
    }

    // ✅ BLOCK if Mango Graham is unavailable
    // (matches your current Android item name "Mango Graham")
    if (String(productName).toLowerCase().includes("mango graham")) {
      const p = await Product.findOne({ slug: "mango-graham" });
      if (p && p.status === "unavailable") {
        return res.status(400).json({
          message: "This flavor is currently out of stock. Sorry"
        });
      }
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const cartItem = {
      cartItemId: crypto.randomUUID(),
      productName,
      size,
      addons: addons || "",
      quantity: Number(quantity),
      totalPrice: Number(totalPrice),
      imageKey: imageKey || ""
    };

    user.cart.push(cartItem);
    await user.save();

    return res.status(201).json({
      message: "Added to cart",
      cart: user.cart
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * DELETE /me/cart/:cartItemId
 */
router.delete("/cart/:cartItemId", auth, async (req, res) => {
  try {
    const { cartItemId } = req.params;

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const before = user.cart.length;
    user.cart = user.cart.filter((i) => i.cartItemId !== cartItemId);

    if (user.cart.length === before) {
      return res.status(404).json({ message: "Cart item not found" });
    }

    await user.save();

    return res.json({
      message: "Removed from cart",
      cart: user.cart
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

module.exports = router;
