require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Product = require("../models/Product");

async function run() {
  await connectDB();

  const products = [
    {
      slug: "avocado",
      name: "Avocado Flavor",
      description: "",
      sizes: { oz12: 70, oz16: 80 },
      addons: {
        pearls: { enabled: true, price: 5 },
        graham: { enabled: true, price: 5 },
        mangobits: { enabled: false, price: 0 },
      },
      status: "available",
    },
    {
      slug: "mango",
      name: "Mango Graham Flavor",
      description: "",
      sizes: { oz12: 45, oz16: 55 },
      addons: {
        pearls: { enabled: true, price: 5 },
        graham: { enabled: true, price: 5 },
        mangobits: { enabled: true, price: 10 },
      },
      status: "available",
    },
    {
      slug: "cucumber",
      name: "Cucumber Flavor",
      description: "",
      sizes: { oz12: 45, oz16: 55 },
      addons: {
        pearls: { enabled: true, price: 5 },
        graham: { enabled: false, price: 0 },
        mangobits: { enabled: false, price: 0 },
      },
      status: "available",
    },
    {
      slug: "guyabano",
      name: "Guyabano Flavor",
      description: "",
      sizes: { oz12: 50, oz16: 60 },
      addons: {
        pearls: { enabled: true, price: 5 },
        graham: { enabled: false, price: 0 },
        mangobits: { enabled: false, price: 0 },
      },
      status: "available",
    },
    {
      slug: "melon",
      name: "Melon Flavor",
      description: "",
      sizes: { oz12: 45, oz16: 55 },
      addons: {
        pearls: { enabled: true, price: 5 },
        graham: { enabled: false, price: 0 },
        mangobits: { enabled: false, price: 0 },
      },
      status: "available",
    },
    {
      slug: "strawberry",
      name: "Strawberry Flavor",
      description: "",
      // Your strawberry admin page only edits 16oz, but we keep oz12 for Android if needed
      sizes: { oz12: 70, oz16: 80 },
      addons: {
        pearls: { enabled: true, price: 5 },
        graham: { enabled: false, price: 0 },
        mangobits: { enabled: false, price: 0 },
      },
      status: "available",
    },
  ];

  for (const p of products) {
    await Product.findOneAndUpdate({ slug: p.slug }, { $set: p }, { upsert: true, new: true });
    console.log("✅ Seeded:", p.slug);
  }

  await mongoose.connection.close();
  console.log("✅ Done seeding products.");
}

run().catch((err) => {
  console.error("❌ Seed error:", err);
  process.exit(1);
});
