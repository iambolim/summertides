// api/pesapal.js — Vercel Serverless Function

// Use sandbox for TestOnly accounts, live for production
const IS_SANDBOX = process.env.PESAPAL_SANDBOX === "true";
const PESAPAL_BASE = IS_SANDBOX
  ? "https://cybqa.pesapal.com/pesapalv3"
  : "https://pay.pesapal.com/v3";

async function supabaseInsert(data) {
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        "Prefer": "return=representation",
      },
      body: JSON.stringify(data),
    });
    return res.json();
  } catch (e) {
    console.error("Supabase insert error:", e);
  }
}

async function supabaseUpdate(reference, data) {
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders?reference=eq.${reference}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify(data),
    });
    return res.json();
  } catch (e) {
    console.error("Supabase update error:", e);
  }
}

async function getPesapalToken() {
  const res = await fetch(`${PESAPAL_BASE}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      consumer_key: process.env.PESAPAL_CONSUMER_KEY,
      consumer_secret: process.env.PESAPAL_CONSUMER_SECRET,
    }),
  });
  const text = await res.text();
  console.log("Pesapal auth response:", text);
  let data;
  try { data = JSON.parse(text); } catch(e) { throw new Error("Invalid auth response: " + text); }
  if (!data.token) throw new Error("Auth failed: " + JSON.stringify(data));
  return data.token;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // IPN callback from Pesapal
  if (req.method === "GET") {
    const { OrderTrackingId, OrderMerchantReference, OrderNotificationType } = req.query;
    if (OrderTrackingId && OrderMerchantReference) {
      try {
        const token = await getPesapalToken();
        const statusRes = await fetch(
          `${PESAPAL_BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${OrderTrackingId}`,
          { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
        );
        const statusData = await statusRes.json();
        const status = statusData.payment_status_description?.toLowerCase() || "unknown";
        await supabaseUpdate(OrderMerchantReference, { status, pesapal_tracking_id: OrderTrackingId });
        return res.status(200).json({
          orderNotificationType: OrderNotificationType,
          orderTrackingId: OrderTrackingId,
          orderMerchantReference: OrderMerchantReference,
          status: "200"
        });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
    return res.status(400).json({ error: "Invalid IPN call" });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { orderData } = req.body;

  try {
    const token = await getPesapalToken();
    const siteBase = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://summertides-kappa.vercel.app";

    // Register IPN
    const ipnRes = await fetch(`${PESAPAL_BASE}/api/URLSetup/RegisterIPN`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url: `${siteBase}/api/pesapal`, ipn_notification_type: "GET" }),
    });
    const ipnData = await ipnRes.json();
    const ipn_id = ipnData.ipn_id || "";

    const { amount, phone, email, firstName, lastName, ticketName, quantity, reference } = orderData;

    // Save to Supabase as pending
    await supabaseInsert({
      reference,
      customer_first_name: firstName,
      customer_last_name: lastName,
      customer_email: email,
      customer_phone: phone,
      ticket_name: ticketName,
      quantity: quantity || 1,
      amount: parseFloat(amount),
      status: "pending",
    });

    // Submit to Pesapal
    const orderRes = await fetch(`${PESAPAL_BASE}/api/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: reference,
        currency: "KES",
        amount: parseFloat(amount),
        description: `Summer Tides 2026 - ${ticketName}`,
        callback_url: `${siteBase}/success.html`,
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
    console.log("Order result:", JSON.stringify(orderResult));

    if (orderResult.redirect_url) {
      return res.status(200).json({ redirect_url: orderResult.redirect_url });
    } else {
      await supabaseUpdate(reference, { status: "failed" });
      return res.status(500).json({ error: "Order failed", details: orderResult });
    }
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}
