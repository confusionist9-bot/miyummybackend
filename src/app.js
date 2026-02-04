// app.js
const express = require("express");
const cors = require("cors");

// Routes
const authRoutes = require("./routes/auth.routes");
const meRoutes = require("./routes/me.routes");
const orderRoutes = require("./routes/order.routes");

const branchesRoutes = require("./routes/branches.routes");

const adminBranchesRoutes = require("./routes/admin.branches.routes");
const adminUsersRoutes = require("./routes/admin.users.routes");
const adminOrderRoutes = require("./routes/admin.orders.routes");
const adminSalesRoutes = require("./routes/admin.sales.routes");
const adminServiceStatusRoutes = require("./routes/admin.serviceStatus.routes");

const productsRoutes = require("./routes/products.routes");
const adminProductsRoutes = require("./routes/admin.products.routes");

const app = express();

// ✅ CORS (IMPORTANT: add x-admin-setup-key)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-setup-key"]
  })
);

// ✅ preflight for all routes
app.options(/.*/, cors());

app.use(express.json());

// ✅ health check
app.get("/", (req, res) => {
  res.json({ ok: true, message: "MiYummy API running" });
});

// ✅ mount routes
app.use("/auth", authRoutes);
app.use("/me", meRoutes);
app.use("/orders", orderRoutes);

app.use("/branches", branchesRoutes);

// ✅ admin routes (dashboard)
app.use("/admin", adminBranchesRoutes);
app.use("/admin", adminUsersRoutes);
app.use("/admin", adminOrderRoutes);
app.use("/admin", adminSalesRoutes);
app.use("/admin", adminServiceStatusRoutes);
app.use("/admin", adminProductsRoutes);

// ✅ products public
app.use("/products", productsRoutes);

module.exports = app;
