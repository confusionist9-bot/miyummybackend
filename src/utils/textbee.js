// utils/textbee.js
export async function sendSmsViaTextBee({ toE164, message }) {
  const apiKey = process.env.TEXTBEE_API_KEY;
  const deviceId = process.env.TEXTBEE_DEVICE_ID;

  if (!apiKey || !deviceId) {
    throw new Error("Missing TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID");
  }

  const url = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      recipients: [toE164],
      message,
    }),
  });

  const raw = await res.text();
  let data = null;
  try { data = JSON.parse(raw); } catch {}

  if (!res.ok) {
    throw new Error(`TextBee send failed (${res.status}): ${raw}`);
  }

  return data ?? { ok: true };
}