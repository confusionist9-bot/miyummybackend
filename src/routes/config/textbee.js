const axios = require("axios");

async function sendSmsTextBee({ recipients, message }) {
  const apiKey = process.env.TEXTBEE_API_KEY;
  const deviceId = process.env.TEXTBEE_DEVICE_ID;

  if (!apiKey || !deviceId) {
    throw new Error("Missing TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID in env");
  }

  const url = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`;

  const res = await axios.post(
    url,
    { recipients, message },
    { headers: { "x-api-key": apiKey, "Content-Type": "application/json" }, timeout: 15000 }
  );

  return res.data;
}

module.exports = { sendSmsTextBee };