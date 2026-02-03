const express = require("express");
const cors = require("cors");

// Routes (existing)
const authRoutes = require("./routes/auth.routes");
const meRoutes = require("./routes/me.routes");
const orderRoutes = require("./routes/order.routes");
const adminOrderRoutes = require("./routes/admin.orders.routes");
const adminSalesRoutes = require("./routes/admin.sales.routes");
const branchesRoutes = require("./routes/branches.routes");
const adminBranchesRoutes = require("./routes/admin.branches.routes");
const adminUsersRoutes = require("./routes/admin.users.routes");
const adminServiceStatusRoutes = require("./routes/admin.serviceStatus.routes");

// NEW product routes
const productsRoutes = require("./routes/products.routes");
const adminProductsRoutes = require("./routes/admin.products.routes");

const app = express();

// ✅ MUST be before routes
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// ✅ SAFE wildcard preflight (prevents path-to-regexp crash)
app.options(/.*/, cors());

app.use(express.json());

// ✅ health check
app.get("/", (req, res) => {
  res.json({ ok: true, message: "MiYummy API running" });
});

// ✅ mount routes AFTER middleware
app.use("/auth", authRoutes);
app.use("/me", meRoutes);
app.use("/orders", orderRoutes);

app.use("/branches", branchesRoutes);

// admin routes
app.use("/admin", adminBranchesRoutes);
app.use("/admin", adminUsersRoutes);
app.use("/admin", adminOrderRoutes);
app.use("/admin", adminSalesRoutes);
app.use("/admin", adminServiceStatusRoutes);

// ✅ products (public + admin edit)
app.use("/products", productsRoutes);
app.use("/admin", adminProductsRoutes);

module.exports = app;
