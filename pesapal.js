// api/pesapal.js — Vercel Serverless Function
// Handles Pesapal authentication and order submission

const PESAPAL_BASE = "https://pay.pesapal.com/v3";

export default async function handler(req, res) {
  // Allow CORS from your frontend
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, orderData } = req.body;

  try {
    // ── STEP 1: Get Pesapal Auth Token ──
    const authRes = await fetch(`${PESAPAL_BASE}/api/Auth/RequestToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        consumer_key: process.env.PESAPAL_CONSUMER_KEY,
        consumer_secret: process.env.PESAPAL_CONSUMER_SECRET,
      }),
    });
    const authData = await authRes.json();
    if (!authData.token) return res.status(500).json({ error: "Auth failed", details: authData });
    const token = authData.token;

    if (action === "get_token") {
      return res.status(200).json({ token });
    }

    // ── STEP 2: Register IPN (Instant Payment Notification) ──
    const ipnRes = await fetch(`${PESAPAL_BASE}/api/URLSetup/RegisterIPN`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        url: `${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "https://your-site.vercel.app"}/api/pesapal`,
        ipn_notification_type: "GET",
      }),
    });
    const ipnData = await ipnRes.json();
    const ipn_id = ipnData.ipn_id || "";

    // ── STEP 3: Submit Order ──
    const { amount, phone, email, firstName, lastName, ticketName, reference } = orderData;

    const orderRes = await fetch(`${PESAPAL_BASE}/api/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: reference,
        currency: "KES",
        amount: parseFloat(amount),
        description: `Summer Tides 2026 - ${ticketName}`,
        callback_url: `${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "https://your-site.vercel.app"}/public/success.html`,
        notification_id: ipn_id,
        billing_address: {
          phone_number: phone,
          email_address: email,
          first_name: firstName,
          last_name: lastName,
          country_code: "KE",
        },
      }),
    });
    const orderResult = await orderRes.json();

    if (orderResult.redirect_url) {
      return res.status(200).json({ redirect_url: orderResult.redirect_url });
    } else {
      return res.status(500).json({ error: "Order failed", details: orderResult });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
