const express = require("express");
const Product = require("../models/Product");

const router = express.Router();

/**
 * PATCH /admin/products/:slug
 * PUBLIC for now (same style as your other /admin routes)
 * body:
 * {
 *   status: "available"|"unavailable",
 *   prices: { oz12: number, oz16: number },
 *   addons: {
 *     pearls: { enabled, price },
 *     graham: { enabled, price },
 *     mangobits: { enabled, price }
 *   }
 * }
 */
router.patch("/products/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const payload = req.body || {};

    // sanitize
    const status = String(payload.status || "").trim();
    const prices = payload.prices || {};
    const addons = payload.addons || {};

    const update = {};

    if (status) {
      if (!["available", "unavailable"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      update.status = status;
    }

    if (prices.oz12 !== undefined) {
  const oz12 = Number(prices.oz12);
  if (!Number.isFinite(oz12) || oz12 < 0) {
    return res.status(400).json({ message: "Invalid size prices" });
  }
  update["prices.oz12"] = oz12;
}

if (prices.oz16 !== undefined) {
  const oz16 = Number(prices.oz16);
  if (!Number.isFinite(oz16) || oz16 < 0) {
    return res.status(400).json({ message: "Invalid size prices" });
  }
  update["prices.oz16"] = oz16;
}


    function setAddon(key) {
      if (!addons[key]) return;
      const enabled = !!addons[key].enabled;
      const price = Number(addons[key].price);
      if (!Number.isFinite(price) || price < 0) {
        throw new Error(`Invalid addon price for ${key}`);
      }
      update[`addons.${key}.enabled`] = enabled;
      update[`addons.${key}.price`] = price;
    }

    try {
      setAddon("pearls");
      setAddon("graham");
      setAddon("mangobits");
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    const product = await Product.findOneAndUpdate(
      { slug },
      { $set: update },
      { new: true, upsert: true }
    );

    return res.json({ message: "Product updated", product });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

module.exports = router;
