# ⚖️ Wakeel — Complete Deployment Guide

## ✅ What's Ready
- 51 screens (React Native + Expo)
- i18n Arabic/English on all screens  
- Assets: icon, splash, adaptive-icon, favicon
- Backend: 28 API routes, 36 DB tables
- All new features: Payment Flow, Compare, Installments, Reviews,
  Bookings, Instant, Notifications, Payment Result, Service Pricing, Video Room

---

## 🖥️ Run Locally (Visual Studio Code)

### Step 1 — Install prerequisites
```
Node.js 18+    → https://nodejs.org
PostgreSQL 14+ → https://postgresql.org  
Expo Go app    → Install on your phone from App Store / Play Store
```

### Step 2 — Database
```bash
psql -U postgres -c "CREATE DATABASE wakeel;"
```

### Step 3 — Backend
```bash
cd wakeel-complete-mobile/backend
cp .env.example .env
# Open .env and set:
#   DB_PASSWORD=your_postgres_password
#   JWT_SECRET=any_random_32+_char_string
npm install
npm run migrate
npm run seed
npm run dev
# ✅ API running at http://localhost:5000
```

### Step 4 — Mobile App
```bash
cd ../mobile
cp .env.example .env
# Open .env and set:
#   Android emulator: EXPO_PUBLIC_API_URL=http://10.0.2.2:5000
#   iOS simulator:    EXPO_PUBLIC_API_URL=http://localhost:5000
#   Physical phone:   EXPO_PUBLIC_API_URL=http://YOUR_PC_IP:5000
npm install
npx expo start
# Scan QR with Expo Go app OR press 'a' for Android / 'i' for iOS
```

### Demo accounts
| Role   | Email             | Password  |
|--------|-------------------|-----------|
| Client | client@demo.com   | demo1234  |
| Lawyer | lawyer@demo.com   | demo1234  |
| Admin  | admin@demo.com    | demo1234  |

---

## 📱 Build for Play Store

### Step 1 — Install EAS CLI
```bash
npm install -g eas-cli
eas login  # create free account at expo.dev
```

### Step 2 — Configure
```bash
cd mobile
eas build:configure  # answers the prompts
```

### Step 3 — Build APK (test before Play Store)
```bash
eas build --platform android --profile preview
# Downloads a .apk you can install directly on any Android phone
```

### Step 4 — Build AAB (for Play Store)
```bash
eas build --platform android --profile production
# Downloads a .aab — this is what you upload to Google Play Console
```

### Step 5 — Google Play Console
1. Go to https://play.google.com/console
2. Create app → "Wakeel - Egypt Legal Marketplace"  
3. Upload the .aab to Internal Testing first
4. Fill in store listing (screenshots, description, category = "Business")
5. Promote to Production when ready

---

## 🔑 Optional API Keys (for full features)

| Feature        | Service       | Where to get                    |
|----------------|---------------|---------------------------------|
| Payments       | Paymob        | https://paymob.com              |
| Video calls    | Daily.co      | https://dashboard.daily.co      |
| Push notifs    | Firebase      | https://console.firebase.google.com |
| SMS/WhatsApp   | Twilio        | https://console.twilio.com      |
| AI chat        | Anthropic     | https://console.anthropic.com   |

Add each key to `backend/.env` — the app works without them using fallback/demo mode.

---

## 🌐 Deploy Backend to Production

### Option A — Railway (easiest, free tier)
1. Push backend folder to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Add PostgreSQL database
4. Set environment variables
5. Done — Railway gives you a URL like `https://wakeel-api.railway.app`

### Option B — Render
1. render.com → New Web Service → Connect GitHub
2. Build command: `npm install`
3. Start command: `npm start`
4. Add PostgreSQL database from Render dashboard

### Then update your mobile `.env`:
```
EXPO_PUBLIC_API_URL=https://your-backend-url.railway.app
```
