// config/firebaseAdmin.js
const admin = require("firebase-admin");

function initFirebaseAdmin() {
  if (admin.apps.length) return admin;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    console.error("❌ Firebase Admin not initialized. Missing FIREBASE_SERVICE_ACCOUNT_JSON.");
    return null;
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (e) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
    return null;
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("✅ Firebase Admin initialized");
  return admin;
}

const adminInstance = initFirebaseAdmin();

module.exports = { admin, adminInstance };