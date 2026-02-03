const express = require("express");
const Order = require("../models/Order");

const router = express.Router();

/**
 * GET /admin/sales/flavors
 * PUBLIC
 * ✅ counts only Delivered orders
 * ✅ splits totals by size (12oz vs 16oz)
 * Returns: [{ flavor, sales12oz, sales16oz }]
 */
router.get("/sales/flavors", async (req, res) => {
  try {
    const result = await Order.aggregate([
      { $match: { status: "Delivered" } }, // ✅ count once Delivered

      { $unwind: "$items" },

      // Normalize size to "12oz" or "16oz" (based on contains "12" or "16")
      {
        $addFields: {
          _sizeLower: { $toLower: "$items.size" }
        }
      },
      {
        $addFields: {
          _sizeNorm: {
            $cond: [
              { $regexMatch: { input: "$_sizeLower", regex: "12" } },
              "12oz",
              {
                $cond: [
                  { $regexMatch: { input: "$_sizeLower", regex: "16" } },
                  "16oz",
                  "other"
                ]
              }
            ]
          }
        }
      },

      // Group by flavor+size
      {
        $group: {
          _id: { flavor: "$items.productName", size: "$_sizeNorm" },
          totalSales: { $sum: "$items.totalPrice" }
        }
      },

      // Pivot into per-flavor fields
      {
        $group: {
          _id: "$_id.flavor",
          sales12oz: {
            $sum: { $cond: [{ $eq: ["$_id.size", "12oz"] }, "$totalSales", 0] }
          },
          sales16oz: {
            $sum: { $cond: [{ $eq: ["$_id.size", "16oz"] }, "$totalSales", 0] }
          }
        }
      },

      {
        $project: {
          _id: 0,
          flavor: "$_id",
          sales12oz: 1,
          sales16oz: 1
        }
      },

      // Sort by total (optional)
      {
        $addFields: { totalAll: { $add: ["$sales12oz", "$sales16oz"] } }
      },
      { $sort: { totalAll: -1 } },
      { $project: { totalAll: 0 } }
    ]);

    return res.json(result);
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

module.exports = router;
