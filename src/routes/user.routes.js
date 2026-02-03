const express = require("express");
const crypto = require("crypto");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();

// Get my profile + addresses + cart
router.get("/", auth, async (req, res) => {
  const user = await User.findById(req.userId).select("-passwordHash");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
});

// Add address (simple)
router.post("/address", auth, async (req, res) => {
  const { fullname, number, barangay, landmark, isDefault } = req.body;
  if (!fullname || !number || !barangay) {
    return res.status(400).json({ message: "fullname, number, barangay are required" });
  }

  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  if (isDefault) {
    user.addresses = user.addresses.map(a => ({ ...a.toObject(), isDefault: false }));
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
  res.json({ message: "Address added", addresses: user.addresses });
});

// Add item to cart
router.post("/cart", auth, async (req, res) => {
  const { productName, size, addons, quantity, totalPrice, imageKey } = req.body;
  if (!productName || !size || !quantity || totalPrice === undefined) {
    return res.status(400).json({ message: "productName, size, quantity, totalPrice required" });
  }

  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  user.cart.push({
    cartItemId: crypto.randomUUID(),
    productName,
    size,
    addons: addons || "",
    quantity,
    totalPrice,
    imageKey: imageKey || ""
  });

  await user.save();
  res.json({ message: "Added to cart", cart: user.cart });
});

// Remove cart item
router.delete("/cart/:cartItemId", auth, async (req, res) => {
  const { cartItemId } = req.params;

  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  user.cart = user.cart.filter(i => i.cartItemId !== cartItemId);
  await user.save();

  res.json({ message: "Removed", cart: user.cart });
});

module.exports = router;
