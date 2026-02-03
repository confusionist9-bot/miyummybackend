const express = require("express");
const Product = require("../models/Product");

const router = express.Router();

// Auto-seed Mango Graham if missing (so your app works immediately)
async function ensureMangoGraham() {
  const slug = "mango-graham";
  const existing = await Product.findOne({ slug });
  if (existing) return existing;

  return await Product.create({
    slug,
    name: "Mango Graham",
    description:
      "Sweet and tropical taste of real mango bits, mixed with soft pearls and crushed graham for extra flavor. This creamy and refreshing shake is a perfect mango treat!",
    status: "available",
    prices: { oz12: 60, oz16: 70 },
    addons: {
      pearls: { enabled: true, price: 5 },
      graham: { enabled: true, price: 5 },
      mangobits: { enabled: true, price: 10 }
    }
  });
}

/**
 * GET /products/:slug
 * PUBLIC: Android uses this to know price + addons + status
 */
router.get("/:slug", async (req, res) => {
  try {
    if (req.params.slug === "mango-graham") {
      await ensureMangoGraham();
    }

    const product = await Product.findOne({ slug: req.params.slug });
    if (!product) return res.status(404).json({ message: "Product not found" });

    return res.json(product);
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

module.exports = router;
