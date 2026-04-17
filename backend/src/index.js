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

  const db = require('./config/db');

  // Core auth/profile columns
  db.query('ALTER TABLE otp_codes ALTER COLUMN phone TYPE VARCHAR(255)').catch(() => {});
  db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url TEXT').catch(() => {});
  db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT').catch(() => {});
  db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT').catch(() => {});
  db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ').catch(() => {});
  db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false').catch(() => {});
  db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ').catch(() => {});

  // Lawyer profile columns
  db.query('ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS consultation_fee INTEGER DEFAULT 400').catch(() => {});
  db.query('ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2) DEFAULT 0').catch(() => {});
  db.query('ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0').catch(() => {});
  db.query('ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0').catch(() => {});
  db.query('ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0').catch(() => {});
  db.query('ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS losses INTEGER DEFAULT 0').catch(() => {});
  db.query('ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS bar_number VARCHAR(50)').catch(() => {});
  db.query('ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS response_time_hours INTEGER').catch(() => {});
  db.query('ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true').catch(() => {});
  db.query('ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false').catch(() => {});
  db.query('ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(20) DEFAULT \'basic\'').catch(() => {});
  db.query('ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS service_prices JSONB').catch(() => {});
  db.query('ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS has_set_schedule BOOLEAN DEFAULT false').catch(() => {});

  // Forum social columns
  db.query('ALTER TABLE forum_questions ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0').catch(() => {});
  db.query('ALTER TABLE forum_questions ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0').catch(() => {});
  db.query('ALTER TABLE forum_questions ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)').catch(() => {});
  db.query('ALTER TABLE forum_questions ADD COLUMN IF NOT EXISTS liked_by JSONB DEFAULT \'[]\'').catch(() => {});

  // Reviews
  db.query('ALTER TABLE reviews ADD COLUMN IF NOT EXISTS outcome VARCHAR(50)').catch(() => {});
  db.query('ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true').catch(() => {});

  // Bookings
  db.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT \'[]\'').catch(() => {});

  // Notifications: add link column if missing
  db.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT DEFAULT \'#\'').catch(() => {});

  // Fix ghost lawyers
  db.query("UPDATE lawyer_profiles SET is_visible=true WHERE is_visible IS NULL").catch(() => {});

  // ── Auto-Expiration of Pending Bookings ─────────────────────────────────────
  // Runs every hour to sweep and reject any pending booking older than 24 hours
  setInterval(() => {
    db.query(`
      UPDATE bookings 
      SET status = 'rejected', cancel_reason = 'Expired automatically due to lawyer inactivity'
      WHERE status = 'pending' AND created_at < NOW() - INTERVAL '24 hours'
      RETURNING id, client_id, lawyer_id
    `).catch(err => console.error('Booking Expiration Error:', err.message));
  }, 60 * 60 * 1000);

  // Ensure consultation_rooms table exists for video conferencing
  db.query(`CREATE TABLE IF NOT EXISTS consultation_rooms (
    id           SERIAL PRIMARY KEY,
    booking_id   INTEGER UNIQUE NOT NULL,
    provider     VARCHAR(20) DEFAULT 'daily',
    room_name    VARCHAR(200),
    room_url     TEXT,
    token_client TEXT,
    token_lawyer TEXT,
    ended_at     TIMESTAMPTZ,
    duration_min INTEGER,
    created_at   TIMESTAMPTZ DEFAULT NOW()
  )`).catch(() => {});

  // Start cron scheduler
  try {
    const { startScheduler } = require('./utils/scheduler');
    startScheduler();
  } catch (err) { console.warn('Scheduler not started:', err.message); }
});

module.exports = { app, server };
