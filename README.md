# 🏖️ Summer Tides 2026 — Deployment Guide

## Files in this project
```
summertides/
├── api/
│   └── pesapal.js          ← Backend: handles Pesapal payments
├── public/
│   ├── summertides-store.html  ← Your main website
│   └── success.html            ← Payment success page
├── vercel.json             ← Vercel config
└── .env.example            ← API keys template (DO NOT share real keys)
```

---

## Step 1 — Create a GitHub account (free)
1. Go to https://github.com
2. Sign up for free
3. Create a new repository called `summertides`
4. Upload all the files from this folder into it

---

## Step 2 — Deploy to Vercel (free)
1. Go to https://vercel.com
2. Sign up with your GitHub account
3. Click **"Add New Project"**
4. Select your `summertides` GitHub repository
5. Click **Deploy**

---

## Step 3 — Add your Pesapal API Keys (IMPORTANT)
1. In Vercel, go to your project → **Settings → Environment Variables**
2. Add these two variables:
   - Name: `PESAPAL_CONSUMER_KEY`  → Value: (your real key)
   - Name: `PESAPAL_CONSUMER_SECRET` → Value: (your real secret)
3. Click **Save** then **Redeploy**

---

## Step 4 — Test it
1. Visit your Vercel URL (e.g. `https://summertides.vercel.app`)
2. Click **Buy Ticket**
3. Fill in details and click **Complete Purchase**
4. You should be redirected to Pesapal payment page ✅

---

## How money works
- Customer pays → Pesapal receives payment
- Money sits in your **Pesapal merchant wallet**
- You withdraw to your **M-Pesa or bank** anytime from Pesapal dashboard

---

## Need help?
Contact Pesapal support: support@pesapal.com
