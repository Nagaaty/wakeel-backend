# Wakeel Mobile — React Native (Expo)
## Production-ready Egyptian legal marketplace app

---

## Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- For Android: Android Studio with emulator OR physical Android device
- For iOS: Mac with Xcode (optional)

---

## Quick Start (5 minutes)

### 1. Install dependencies
```bash
cd wakeel-mobile
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env` and set your backend IP:
```
EXPO_PUBLIC_API_URL=http://192.168.1.X:5000
```
> **Find your IP:**
> - Windows: `ipconfig` → look for IPv4 Address
> - Mac/Linux: `ifconfig` → look for inet under en0
> - Must use local IP (not `localhost`) for physical device

### 3. Start backend first
```bash
cd ../wakeel-react
npm run dev
```

### 4. Start mobile app
```bash
cd ../wakeel-mobile
npx expo start
```
- Press `a` → Android emulator
- Press `i` → iOS simulator (Mac only)
- Scan QR code with **Expo Go** app → physical device

---

## Demo Accounts
| Role    | Email                 | Password   |
|---------|----------------------|------------|
| Client  | client@demo.com      | demo1234   |
| Lawyer  | lawyer@demo.com      | demo1234   |
| Admin   | admin@demo.com       | demo1234   |

---

## Build for Production

### Android APK (for testing/sideloading)
```bash
npx eas build --platform android --profile preview
```

### Android App Bundle (for Play Store)
```bash
npx eas build --platform android --profile production
```

### iOS (requires Apple Developer account + Mac)
```bash
npx eas build --platform ios --profile production
```

### Local Android build (no EAS account)
```bash
npx expo run:android
```

---

## Project Structure
```
wakeel-mobile/
├── app/                        # All screens (Expo Router)
│   ├── _layout.tsx             # Root: Redux + SafeArea + Push notifications
│   ├── (auth)/                 # Login, Register, ResetPassword, VerifyEmail
│   ├── (tabs)/                 # Home, Lawyers, AI, Jobs, Profile (bottom tabs)
│   ├── lawyer/                 # [id].tsx (profile), dashboard.tsx
│   ├── messages/               # index.tsx (real-time chat)
│   ├── admin/                  # index, verification, support, promos
│   └── *.tsx                   # 30+ feature screens
├── src/
│   ├── components/ui/          # Btn, Inp, Card, Avatar, Stars, Badge, etc.
│   ├── hooks/
│   │   ├── useAuth.ts          # Auth state + logout
│   │   └── useTheme.ts         # Dark/Light theme
│   ├── services/api.ts         # All 27 API objects → same backend
│   ├── store/
│   │   ├── index.ts            # Redux store
│   │   └── slices/             # auth, bookings, lawyers, messages, subscriptions
│   ├── theme/index.ts          # Color tokens (DARK + LIGHT)
│   ├── types/index.ts          # TypeScript interfaces
│   └── utils/
│       ├── storage.ts          # SecureStore wrapper (JWT stored safely)
│       ├── socket.ts           # Socket.io singleton manager
│       └── notifications.ts   # Push notification registration
├── assets/                     # icon.png, splash.png, etc.
├── app.json                    # Expo config (permissions, bundle ID)
├── eas.json                    # Build profiles
├── babel.config.js
└── tsconfig.json
```

---

## Architecture Notes

### Same backend, zero changes
The mobile app calls the exact same 28 Node.js routes as the web app.
Change `EXPO_PUBLIC_API_URL` to switch between local/staging/production.

### Security
- JWT tokens stored in `expo-secure-store` (encrypted, not AsyncStorage)
- Biometric auth ready via `expo-local-authentication`

### Real-time
- Socket.io singleton in `src/utils/socket.ts`
- Auto-reconnect with 5 attempts
- Used in: Messages, InstantConsult, Notifications

### State management
- Redux Toolkit slices for: auth, bookings, lawyers, messages, subscriptions
- AsyncStorage for non-sensitive user data
- SecureStore for JWT tokens

### Navigation
- Expo Router (file-based, like Next.js)
- (auth) group → redirects to tabs if logged in
- (tabs) group → redirects to login if not logged in

---

## Adding Push Notifications (Firebase)
1. Create Firebase project at console.firebase.google.com
2. Add Android/iOS apps, download `google-services.json` and `GoogleService-Info.plist`
3. Place them in project root
4. Update `app.json` with your `googleServicesFile` and `googleServicesFile` paths
5. Register token in backend: already handled in `_layout.tsx`

---

## Common Issues

**"Network request failed"**
→ Backend not running, or wrong IP in `.env`

**"Module not found"**
→ Run `npm install`

**Camera/mic not working in video calls**
→ Must test on physical device, not emulator

**Push notifications not working**
→ Must test on physical device (not Expo Go for production push)
