require('dotenv').config();
const express      = require('express');
const http         = require('http');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');

const app    = express();
const server = http.createServer(app);

// ── Security middleware ────────────────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));
// React Native clients don't send Origin header, so allow all in dev
// In production, lock this down to your domain
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (React Native, mobile apps, Postman)
    if (!origin) return callback(null, true);
    const allowed = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,   // Android emulator host
      /^http:\/\/192\.168\.\d+\.\d+:\d+$/,    // Local network
      /^exp:\/\//,                                   // Expo dev client
    ];
    const ok = allowed.some(a => typeof a === 'string' ? a === origin : a.test(origin));
    callback(null, ok || process.env.NODE_ENV !== 'production');
  },
  credentials: true,
}));

// ── Rate limiting ──────────────────────────────────────────────────────────────
const generalLimit = rateLimit({ windowMs: 15*60*1000, max: 200, standardHeaders: true, legacyHeaders: false });
const authLimit    = rateLimit({ windowMs: 15*60*1000, max: 20,  message: { message: 'Too many auth attempts' } });
const aiLimit      = rateLimit({ windowMs: 60*1000,    max: 10,  message: { message: 'AI rate limit — wait 1 minute' } });

app.use(generalLimit);
app.use('/api/auth', authLimit);
app.use('/api/ai',   aiLimit);

// ── Body parsing ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// ── Socket.io real-time ────────────────────────────────────────────────────────
let io = null;
try {
  const { initSocket } = require('./utils/socket');
  io = initSocket(server);
  app.set('io', io);
} catch (err) { console.warn('Socket.io not initialized:', err.message); }

// ── Static uploads (local dev fallback) ───────────────────────────────────────
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true, time: new Date() }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/lawyers',     require('./routes/lawyers'));
app.use('/api/bookings',    require('./routes/bookings'));
app.use('/api/payments',    require('./routes/payments'));
app.use('/api/messages',    require('./routes/messages'));
app.use('/api/admin',       require('./routes/admin'));
app.use('/api/notifications',require('./routes/notifications'));
app.use('/api/favorites',   require('./routes/favorites'));
app.use('/api/video',       require('./routes/video'));
app.use('/api/ai',          require('./routes/ai'));
app.use('/api/support',     require('./routes/support'));
app.use('/api/promos',      require('./routes/promos'));
app.use('/api/verification',require('./routes/verification'));
app.use('/api/subscriptions',require('./routes/subscriptions'));
app.use('/api/payouts',     require('./routes/payouts'));

app.use('/api/upload',      require('./routes/upload'));
app.use('/api/push',        require('./routes/push'));
app.use('/api/invoices',    require('./routes/invoices'));
app.use('/api/installments',require('./routes/installments'));
app.use('/api/analytics',   require('./routes/analytics'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/broadcast', require('./routes/broadcast'));
app.use('/api/users',     require('./routes/users'));
app.use('/api/court-dates', require('./routes/court_dates'));
app.use('/api/forum',       require('./routes/forum'));
app.use('/api/referral',    require('./routes/referral'));
app.use('/api/content',     require('./routes/content'));
app.use('/api/vault',       require('./routes/document_vault'));

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` }));

// ── Error handler ──────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Wakeel API running on port ${PORT}`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`📧 Email: ${process.env.EMAIL_HOST || process.env.EMAIL_SENDGRID_KEY ? '✅ configured' : '⚠️  not configured'}`);
  console.log(`📱 Twilio: ${process.env.TWILIO_ACCOUNT_SID ? '✅ configured' : '⚠️  not configured'}`);
  console.log(`💳 Paymob: ${process.env.PAYMOB_API_KEY ? '✅ configured' : '⚠️  not configured'}`);
  console.log(`🎥 Daily.co: ${process.env.DAILY_API_KEY ? '✅ configured' : '⚠️  not configured'}`);
  console.log(`📲 Firebase: ${process.env.FIREBASE_PROJECT_ID ? '✅ configured' : '⚠️  not configured'}`);
  console.log(`☁️  R2 Storage: ${process.env.R2_ACCOUNT_ID ? '✅ configured' : '⚠️  local storage'}`);

  // Start cron scheduler
  try {
    const { startScheduler } = require('./utils/scheduler');
    startScheduler();
  } catch (err) { console.warn('Scheduler not started:', err.message); }
});

module.exports = { app, server };
