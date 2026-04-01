# ⚖️ Wakeel — Complete Mobile App

Egyptian Legal Marketplace · React Native + Node.js + PostgreSQL

---

## What's in this package

```
wakeel-complete-mobile/
├── backend/          ← Node.js API server (same backend as web app)
│   ├── src/
│   │   ├── routes/   ← 28 route files
│   │   ├── utils/    ← email, sms, socket, payments, scheduler...
│   │   └── middleware/
│   └── migrations/   ← PostgreSQL schema + seed data
├── mobile/           ← React Native (Expo) app
│   ├── app/          ← 47 screens (Expo Router)
│   └── src/          ← Redux, API service, hooks, utils, types
├── package.json      ← Root scripts to run everything
└── README.md
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | nodejs.org |
| PostgreSQL | 14+ | postgresql.org |
| Expo CLI | latest | `npm i -g expo-cli` |
| Expo Go app | latest | App Store / Play Store |

---

## Setup (First Time)

### Step 1 — Database

```bash
# Start PostgreSQL, then:
psql -U postgres -c "CREATE DATABASE wakeel;"
```

### Step 2 — Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set DB_USER, DB_PASSWORD, JWT_SECRET at minimum
npm install
npm run migrate   # Creates all 36 tables
npm run seed      # Adds demo lawyers, users, data
npm run dev       # Starts on http://localhost:5000
```

Verify it's running: open http://localhost:5000/health → should return `{"ok":true}`

### Step 3 — Mobile App

Open a **new terminal**:

```bash
cd mobile
cp .env.example .env
# Edit .env — set EXPO_PUBLIC_API_URL (see below)
npm install
npx expo start
```

---

## Setting the API URL (Critical)

Edit `mobile/.env`:

| Where you're running the app | Set EXPO_PUBLIC_API_URL to |
|------------------------------|---------------------------|
| Android emulator | `http://10.0.2.2:5000` |
| iOS simulator | `http://localhost:5000` |
| Physical Android/iOS device | `http://YOUR_PC_IP:5000` |

**Find your PC's IP:**
- Windows: Open CMD → `ipconfig` → IPv4 Address
- Mac/Linux: Open Terminal → `ifconfig` → inet under en0

Example for physical device: `EXPO_PUBLIC_API_URL=http://192.168.1.42:5000`

---

## Running the App

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Mobile
cd mobile && npx expo start
```

Then:
- **Android emulator**: Press `a` in the Expo terminal
- **iOS simulator**: Press `i` (Mac only)
- **Physical device**: Scan the QR code with Expo Go app

---

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Client | client@demo.com | demo1234 |
| Lawyer | lawyer@demo.com | demo1234 |
| Admin | admin@demo.com | demo1234 |

---

## App Features

### For Clients
- 🔍 Search & filter 1,200+ verified lawyers
- 📅 Book consultations (text, voice, video, in-person, document review)
- 💳 Pay via Paymob (card, Fawry, wallet)
- 💬 Real-time chat with lawyers
- 📹 Video consultations via Daily.co
- 📣 Broadcast requests — post your legal need, get bids
- ⚡ Instant consultation with online lawyers
- 🎯 AI-powered lawyer matching
- 📄 AI document analyzer
- 🔮 Case outcome predictor
- ⏰ Court date reminders
- 🔐 Encrypted document vault
- 🌍 Multilingual AI (Arabic/English/French)

### For Lawyers
- 📊 Full dashboard with 6 management tools
- 📅 Availability calendar management
- 👥 Client CRM system
- 💰 Earnings tracker with monthly charts
- 📝 Case notes per booking
- 📊 Win/loss outcome tracker
- 📁 Shared case folder with clients
- 💲 Per-service pricing control
- 🏆 Subscription plans
- 📈 Analytics dashboard

### For Admins
- 🛡️ Platform statistics
- ⚖️ Lawyer verification workflow
- 🎫 Support ticket management
- 🎟️ Promo code management

---

## Architecture

```
Mobile App (React Native/Expo)
         ↓ HTTP/WebSocket
Backend API (Node.js/Express)    port 5000
         ↓ SQL
PostgreSQL Database              port 5432
```

### Backend routes (28 total)
`auth` · `lawyers` · `bookings` · `payments` · `messages` · `notifications`
`favorites` · `video` · `ai` · `support` · `promos` · `verification`
`subscriptions` · `payouts` · `upload` · `push` · `invoices` · `installments`
`analytics` · `jobs` · `broadcast` · `users` · `court-dates` · `forum`
`referral` · `content` · `vault` · `admin`

### Mobile screens (47 total)
Auth (4) · Tabs (5) · Lawyer (2) · Messages (1) · Admin (4) · Features (31)

### Database (36 tables)
users · lawyer_profiles · categories · bookings · payments · conversations
messages · reviews · favorites · notifications · subscriptions · support_tickets
ticket_messages · promo_codes · payout_requests · court_dates · forum_questions
forum_answers · document_vault · otp_codes · push_tokens · file_uploads
audit_logs · lawyer_availability · consultation_rooms · installments · invoices
broadcast_requests · broadcast_bids · jobs · job_applications · + more

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Min 32 chars, keep secret |
| `PORT` | ✅ | Default: 5000 |
| `PAYMOB_API_KEY` | Optional | For real payments |
| `DAILY_API_KEY` | Optional | For video calls |
| `OPENAI_API_KEY` | Optional | For AI features |
| `FIREBASE_PROJECT_ID` | Optional | For push notifications |
| `TWILIO_ACCOUNT_SID` | Optional | For SMS/WhatsApp |
| `EMAIL_HOST` | Optional | For email notifications |

### Mobile (`mobile/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_API_URL` | ✅ | Backend URL (see table above) |

---

## Building for Production

### Android APK
```bash
cd mobile
npx eas build --platform android --profile preview
```

### Play Store Bundle
```bash
cd mobile
npx eas build --platform android --profile production
```

### iOS App Store
```bash
cd mobile
npx eas build --platform ios --profile production
```

### Backend Deployment (example: Railway / Render / VPS)
```bash
# Set environment variables in your hosting dashboard
# Then:
npm start
```

---

## Troubleshooting

**"Network request failed"**
→ Backend not running OR wrong EXPO_PUBLIC_API_URL
→ Check: is `http://localhost:5000/health` returning `{"ok":true}`?
→ For physical device: use your machine's IP, not localhost

**"relation does not exist"**
→ Run: `cd backend && npm run migrate`

**"invalid password"** on demo accounts
→ Run: `cd backend && npm run seed`

**Expo QR not scanning**
→ Make sure phone and PC are on the same WiFi network

**Video calls not working**
→ Need real DAILY_API_KEY, works on physical device only

**Push notifications not working**
→ Need Firebase setup, works on physical device only (not Expo Go)

