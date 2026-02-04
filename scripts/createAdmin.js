require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../src/models/User"); // adjust path if needed

async function createAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);

  const passwordHash = await bcrypt.hash("mmaymamanggo123", 10);

  const admin = await User.create({
    firstName: "Admin",
    lastName: "User",
    username: "admin",
    email: "admin@miyummy.com",
    mobile: "09999999999",
    passwordHash,
    isAdmin: true
  });

  console.log("✅ Admin created:", admin.username);
  process.exit(0);
}

createAdmin();
