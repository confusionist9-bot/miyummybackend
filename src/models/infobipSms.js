const axios = require("axios");

// Infobip Base URL looks like: xxxxx.api.infobip.com
async function sendOtpSmsInfobip({ baseUrl, apiKey, toE164, text, from }) {
  const url = `https://${baseUrl}/sms/3/messages`;

  const res = await axios.post(
    url,
    {
      messages: [
        {
          destinations: [{ to: toE164 }],
          text,
          from: from || "ServiceSMS"
        }
      ]
    },
    {
      headers: {
        Authorization: `App ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      timeout: 15000
    }
  );

  return res.data;
}

module.exports = { sendOtpSmsInfobip };
