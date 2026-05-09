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

// ⚙️ Backend Engineer Agent: Sentry Crash Reporting
// Only initialized if SENTRY_DSN is provided in .env
const Sentry = require('@sentry/node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });
  console.log('🛡️ Sentry Crash Reporter initialized');
}

// Trust Render's proxy (fixes rate-limit X-Forwarded-For warning)
app.set('trust proxy', 1);

// ── Security middleware ────────────────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
      /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
      /^exp:\/\//,
    ];
    const ok = allowed.some(a => typeof a === 'string' ? a === origin : a.test(origin));
    callback(null, ok || process.env.NODE_ENV !== 'production');
  },
  credentials: true,
}));

// Skip rate limits for localhost / LAN in development
const skipForLocalDev = (req) => {
  if (process.env.NODE_ENV === 'production') return false;
  const ip = req.ip || req.socket?.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.');
};

const generalLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,          // 5x increase — covers heavy forum usage
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipForLocalDev,
  message: { message: 'Too many requests, please try again later.' },
});
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,            // was 20 — more forgiving for dev
  skip: skipForLocalDev,
  message: { message: 'Too many auth attempts' },
});
const aiLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,            // was 10 — doubled
  skip: skipForLocalDev,
  message: { message: 'AI rate limit — wait 1 minute' },
});

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
app.use('/api/health', require('./routes/health'));

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
app.use('/api/jobs',        require('./routes/jobs'));
app.use('/api/broadcast',   require('./routes/broadcast'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/court-dates', require('./routes/court_dates'));
app.use('/api/forum',       require('./routes/forum'));
app.use('/api/referral',    require('./routes/referral'));
app.use('/api/content',     require('./routes/content'));
app.use('/api/vault',       require('./routes/document_vault'));

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` }));

// ── Error handler ──────────────────────────────────────────────────────────────
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}
app.use(errorHandler);

// ── Start server ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Wakeel API running on port ${PORT}`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`📧 Email: ${process.env.EMAIL_HOST || process.env.EMAIL_SENDGRID_KEY ? '✅ configured' : '⚠️  not configured'}`);
  console.log(`📱 Twilio: ${process.env.TWILIO_ACCOUNT_SID ? '✅ configured' : '⚠️  not configured'}`);
  console.log(`💳 Paymob: ${process.env.PAYMOB_API_KEY ? '✅ configured' : '⚠️  not configured'}`);
  console.log(`🎥 Daily.co: ${process.env.DAILY_API_KEY ? '✅ configured' : '⚠️  not configured'}`);
  console.log(`📲 Firebase: ${process.env.FIREBASE_PROJECT_ID ? '✅ configured' : '⚠️  not configured'}`);
  console.log(`☁️  R2 Storage: ${process.env.R2_ACCOUNT_ID ? '✅ configured' : '⚠️  local storage'}`);

  // ── Unified DB migrations (runs once, tracked in schema_migrations table) ──
  const { runMigrations } = require('./migrate');
  runMigrations().catch(err => console.error('❌ Migration error:', err.message));

  // ── Auto-Expiration of Pending Bookings ─────────────────────────────────────
  const db = require('./config/db');
  setInterval(() => {
    db.query(`
      UPDATE bookings 
      SET status = 'rejected', cancel_reason = 'Expired automatically due to lawyer inactivity'
      WHERE status = 'pending' AND created_at < NOW() - INTERVAL '24 hours'
      RETURNING id, client_id, lawyer_id
    `).catch(err => console.error('Booking Expiration Error:', err.message));
  }, 60 * 60 * 1000);

  // Start cron scheduler
  try {
    const { startScheduler } = require('./utils/scheduler');
    startScheduler();
  } catch (err) { console.warn('Scheduler not started:', err.message); }
});
}

module.exports = { app, server };
// touch
