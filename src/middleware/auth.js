const jwt = require("jsonwebtoken");
const User = require("../models/User"); // ✅ adjust path if your folder structure is different

async function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, code: "NO_TOKEN", message: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Check if user still exists (important for "admin deleted user" case)
    const user = await User.findById(payload.userId).select("_id").lean();
    if (!user) {
      return res
        .status(401)
        .json({ success: false, code: "ACCOUNT_DELETED", message: "Account no longer exists" });
    }

    req.userId = payload.userId;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, code: "INVALID_TOKEN", message: "Invalid token" });
  }
}

module.exports = auth;