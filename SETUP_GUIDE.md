# ⚖️ Wakeel — Complete Setup Guide
## Run the app on your local machine + test on your phone

---

## BEFORE YOU START — Install these once

| Tool | Where to get it | Check it works |
|------|----------------|----------------|
| **Node.js 18+** | nodejs.org → LTS version | `node -v` → v18 or higher |
| **PostgreSQL 14+** | postgresql.org | `psql --version` |
| **Expo Go app** | App Store or Play Store on your phone | — |

> ⚠️ Your phone and PC must be on the **same WiFi network**

---

## STEP 1 — Unzip the project

```
wakeel-mobile-complete/
├── backend/      ← Node.js API
├── mobile/       ← React Native app
└── README.md
```

---

## STEP 2 — Create the database

Open a terminal and run:

**Windows (Command Prompt or PowerShell):**
```
psql -U postgres -c "CREATE DATABASE wakeel;"
```

**Mac/Linux:**
```bash
psql -U postgres -c "CREATE DATABASE wakeel;"
```

If prompted for a password, use your PostgreSQL password (set when you installed PostgreSQL).

---

## STEP 3 — Set up the backend

Open a terminal in the `backend/` folder:

```bash
cd backend

# 1. Copy the environment file
cp .env.example .env       # Mac/Linux
copy .env.example .env     # Windows

# 2. Edit .env — open it in any text editor and change these 2 lines:
#    DB_PASSWORD=your_postgresql_password
#    JWT_SECRET=any_random_string_at_least_32_characters

# 3. Install packages
npm install

# 4. Create all database tables (run once)
npm run migrate

# 5. Add demo data (lawyers, users, etc.)
npm run seed

# 6. Start the server
npm run dev
```

You should see:
```
🚀 Wakeel API running on port 5000
```

**Test it works:** Open http://localhost:5000/health in your browser → should show `{"ok":true}`

---

## STEP 4 — Find your PC's IP address

Your phone needs your PC's IP to connect. **Both must be on the same WiFi.**

**Windows:**
1. Open Command Prompt
2. Type: `ipconfig`
3. Look for **IPv4 Address** under your WiFi adapter
4. It looks like: `192.168.1.42`

**Mac:**
1. Open Terminal
2. Type: `ifconfig | grep "inet " | grep -v 127.0.0.1`
3. You'll see something like: `inet 192.168.1.42`

**Linux:**
```bash
hostname -I | awk '{print $1}'
```

> Write down this IP — you need it in the next step.

---

## STEP 5 — Set up the mobile app

Open a **new terminal** in the `mobile/` folder (keep the backend terminal open):

```bash
cd mobile

# 1. Copy the environment file
cp .env.example .env       # Mac/Linux
copy .env.example .env     # Windows

# 2. Edit .env — set your PC's IP from Step 4:
#    EXPO_PUBLIC_API_URL=http://192.168.1.42:5000
#    (replace 192.168.1.42 with YOUR actual IP)

# 3. Install packages (takes 2-3 minutes)
npm install

# 4. Start Expo
npx expo start
```

You will see a **QR code** in the terminal.

---

## STEP 6 — Open on your phone

1. Open the **Expo Go** app on your phone
2. Scan the QR code from the terminal
3. The app will load in about 30 seconds

---

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Client | client@demo.com | demo1234 |
| Lawyer | lawyer@demo.com | demo1234 |
| Admin | admin@demo.com | demo1234 |

---

## What you can test immediately (no extra setup)

- ✅ Register new account / Login
- ✅ Browse lawyers (search, filter by specialization, city, price)
- ✅ View lawyer profiles, ratings, availability
- ✅ Book a consultation (all 5 types: text/voice/video/in-person/document)
- ✅ Real-time chat with lawyers
- ✅ My bookings, cancel, mark complete
- ✅ Lawyer dashboard (availability, CRM, earnings, case notes)
- ✅ Broadcast legal request + receive bids
- ✅ Court dates calendar
- ✅ Document vault
- ✅ Forum Q&A
- ✅ Admin panel (approve lawyers, manage tickets)
- ✅ Leaderboard, FAQ, Glossary, News
- ✅ Referral program, Subscriptions
- ✅ Edit profile, change password

---

## Enable AI features (free)

1. Go to https://console.anthropic.com and create a free account (get $5 free credit)
2. Create an API key
3. Open `backend/.env` and add:
   ```
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```
4. Restart the backend: `npm run dev`

This unlocks:
- 🤖 AI legal assistant chat
- 📄 Document analyzer
- 🎯 Smart lawyer matching

---

## Troubleshooting

**"Network request failed" on phone**
→ Wrong IP in `mobile/.env` — double-check Step 4
→ Make sure backend is running (check backend terminal)
→ Phone and PC on same WiFi?

**"Cannot connect to database"**
→ PostgreSQL not running — start it in Services (Windows) or `brew services start postgresql` (Mac)
→ Wrong password in `backend/.env`

**"relation does not exist" error**
→ Run `npm run migrate` again in the backend folder

**App shows blank screen**
→ Wait 10-15 seconds — first load is slower
→ Shake phone → "Reload" in Expo menu

**QR code not scanning**
→ Make sure phone camera has permission in Expo Go
→ Try typing the URL manually: press "e" in Expo terminal to get the URL

**Port 5000 already in use**
→ Change PORT=5001 in `backend/.env`
→ Update `mobile/.env`: `EXPO_PUBLIC_API_URL=http://192.168.1.42:5001`

---

## Two terminals you need open

```
Terminal 1 (backend):          Terminal 2 (mobile):
─────────────────────          ────────────────────
cd backend                     cd mobile
npm run dev                    npx expo start
↓                              ↓
Wakeel API on port 5000        QR code → scan with Expo Go
```

Keep both running while testing.
