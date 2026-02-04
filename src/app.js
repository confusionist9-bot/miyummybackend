const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// helps preflight
app.options(/.*/, cors());

app.use(express.json());

app.get("/", (req, res) => res.json({ ok: true, message: "MiYummy API running" }));

app.use("/auth", authRoutes);

module.exports = app;
