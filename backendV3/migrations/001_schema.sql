-- Wakeel Egypt Legal Marketplace - Database Schema
-- Run: psql -U postgres -d wakeel_db -f 001_schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(200) NOT NULL,
  email        VARCHAR(200) UNIQUE NOT NULL,
  phone        VARCHAR(30),
  national_id  VARCHAR(20),
  password_hash VARCHAR(200) NOT NULL,
  role         VARCHAR(20) NOT NULL DEFAULT 'client' CHECK (role IN ('client','lawyer','admin')),
  city         VARCHAR(100) DEFAULT 'Cairo',
  avatar       TEXT,
  cover_url    TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  is_verified  BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LAWYER PROFILES ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS lawyer_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(100) DEFAULT 'Attorney at Law',
  bar_id          VARCHAR(50),
  specialization  VARCHAR(100),
  category_id     INTEGER DEFAULT 1,
  experience      INTEGER DEFAULT 0,
  price           INTEGER DEFAULT 500,
  bio             TEXT,
  city            VARCHAR(100) DEFAULT 'Cairo',
  office          TEXT,
  office_hours    VARCHAR(100) DEFAULT 'Sun-Thu 10AM-5PM',
  phone           VARCHAR(30),
  website         VARCHAR(200),
  languages       TEXT[] DEFAULT ARRAY['Arabic'],
  rating          DECIMAL(3,2) DEFAULT 4.5,
  review_count    INTEGER DEFAULT 0,
  case_count      INTEGER DEFAULT 0,
  response_time   VARCHAR(50) DEFAULT '< 1 hour',
  is_verified     BOOLEAN DEFAULT FALSE,
  is_available    BOOLEAN DEFAULT TRUE,
  subscription    VARCHAR(20) DEFAULT 'basic' CHECK (subscription IN ('basic','pro','elite')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LAW CATEGORIES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) NOT NULL,
  icon  VARCHAR(10),
  description TEXT
);

-- ─── BOOKINGS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lawyer_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  type            VARCHAR(20) DEFAULT 'VIDEO' CHECK (type IN ('VIDEO','CHAT','PHONE')),
  status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled','refunded')),
  amount          INTEGER NOT NULL DEFAULT 500,
  platform_fee    INTEGER DEFAULT 50,
  notes           TEXT,
  cancel_reason   TEXT,
  refund_status   VARCHAR(20) CHECK (refund_status IN ('none','pending','processed')),
  refund_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PAYMENTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id    UUID REFERENCES bookings(id),
  user_id       UUID NOT NULL REFERENCES users(id),
  amount        INTEGER NOT NULL,
  method        VARCHAR(30) DEFAULT 'CARD',
  status        VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  ref_id        VARCHAR(100),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MESSAGES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lawyer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, lawyer_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── REVIEWS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id  UUID REFERENCES bookings(id),
  client_id   UUID NOT NULL REFERENCES users(id),
  lawyer_id   UUID NOT NULL REFERENCES users(id),
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── FAVORITES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorites (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lawyer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lawyer_id)
);

-- ─── NOTIFICATIONS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  type        VARCHAR(30) DEFAULT 'general',
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SUBSCRIPTIONS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lawyer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan        VARCHAR(20) DEFAULT 'basic' CHECK (plan IN ('basic','pro','elite')),
  price       INTEGER DEFAULT 0,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  is_active   BOOLEAN DEFAULT TRUE
);

-- ─── INDEXES ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_lawyer ON bookings(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_user ON lawyer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- ─── Support Tickets ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  booking_id    UUID REFERENCES bookings(id) ON DELETE SET NULL,
  subject       VARCHAR(255) NOT NULL,
  category      VARCHAR(60)  NOT NULL DEFAULT 'general',
  status        VARCHAR(30)  NOT NULL DEFAULT 'open',   -- open | in_progress | resolved | closed
  priority      VARCHAR(20)  NOT NULL DEFAULT 'normal', -- low | normal | high | urgent
  user_name     VARCHAR(120),
  user_email    VARCHAR(255),
  user_phone    VARCHAR(30),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_role VARCHAR(20) NOT NULL DEFAULT 'user',   -- user | agent | ai
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user    ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status  ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_msgs     ON ticket_messages(ticket_id);

-- ─── Promo Codes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(30)  NOT NULL UNIQUE,
  discount_type VARCHAR(10)  NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','fixed')),
  discount_value INTEGER      NOT NULL,          -- percent: 0-100, fixed: EGP amount
  min_amount    INTEGER      DEFAULT 0,          -- minimum booking amount to apply
  max_uses      INTEGER      DEFAULT NULL,       -- NULL = unlimited
  uses_count    INTEGER      DEFAULT 0,
  valid_from    TIMESTAMPTZ  DEFAULT NOW(),
  valid_until   TIMESTAMPTZ  DEFAULT NULL,       -- NULL = no expiry
  is_active     BOOLEAN      DEFAULT TRUE,
  created_by    UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- Track who used which promo
CREATE TABLE IF NOT EXISTS promo_uses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id   UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  discount_applied INTEGER NOT NULL,
  used_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(promo_id, user_id)  -- one use per user per code
);

-- ─── Subscription enhancements ───────────────────────────────────────────────
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paymob_order_id VARCHAR(100);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at    TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_reason   TEXT;

-- Seed promo codes
INSERT INTO promo_codes (code, discount_type, discount_value, min_amount, max_uses, valid_until)
VALUES
  ('WELCOME20', 'percent', 20, 0,    NULL, NOW() + INTERVAL '1 year'),
  ('LEGAL10',   'percent', 10, 200,  500,  NOW() + INTERVAL '6 months'),
  ('FIRST50',   'fixed',   50, 300,  1000, NOW() + INTERVAL '3 months'),
  ('VIP30',     'percent', 30, 500,  100,  NOW() + INTERVAL '2 months')
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_uses_user ON promo_uses(user_id);

-- ─── Lawyer verification & per-service pricing ───────────────────────────────
ALTER TABLE lawyer_profiles
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending'
    CHECK (verification_status IN ('pending','approved','rejected','suspended')),
  ADD COLUMN IF NOT EXISTS verification_note    TEXT,
  ADD COLUMN IF NOT EXISTS verified_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS price_chat           INTEGER,   -- text consultation
  ADD COLUMN IF NOT EXISTS price_voice          INTEGER,   -- voice call
  ADD COLUMN IF NOT EXISTS price_video          INTEGER,   -- video call
  ADD COLUMN IF NOT EXISTS price_case_study     INTEGER,   -- deep case review
  ADD COLUMN IF NOT EXISTS price_contract       INTEGER,   -- contract drafting
  ADD COLUMN IF NOT EXISTS price_memo           INTEGER,   -- legal memo
  ADD COLUMN IF NOT EXISTS price_court          INTEGER,   -- court attendance
  ADD COLUMN IF NOT EXISTS price_inperson       INTEGER,   -- office visit
  ADD COLUMN IF NOT EXISTS available_since      TIMESTAMPTZ; -- when lawyer went online

CREATE INDEX IF NOT EXISTS idx_lawyer_verification ON lawyer_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_lawyer_available    ON lawyer_profiles(is_available);

-- ─── Support enhancements: SLA + ratings ─────────────────────────────────────
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS first_response_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_to        UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rating             INTEGER CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_comment     TEXT,
  ADD COLUMN IF NOT EXISTS sla_hours          INTEGER DEFAULT 2,  -- target first response in X hours
  ADD COLUMN IF NOT EXISTS sla_breached       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source             VARCHAR(20) DEFAULT 'ticket'; -- ticket | chat_escalation

-- ─── Payout requests ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payout_requests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lawyer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  method      VARCHAR(20) NOT NULL CHECK (method IN ('instapay','vodafone','bank','fawry')),
  account_num VARCHAR(100) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  status      VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','rejected')),
  note        TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_payout_lawyer ON payout_requests(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_payout_status ON payout_requests(status);

-- ─── New tables for additional features ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS court_dates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  court       VARCHAR(200),
  case_ref    VARCHAR(100),
  date        DATE NOT NULL,
  time        VARCHAR(20),
  type        VARCHAR(30) DEFAULT 'hearing',
  reminder    BOOLEAN DEFAULT true,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_questions (
  id          SERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  question    TEXT NOT NULL,
  category    VARCHAR(100),
  anonymous   BOOLEAN DEFAULT true,
  is_visible  BOOLEAN DEFAULT true,
  views       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_answers (
  id           SERIAL PRIMARY KEY,
  question_id  INTEGER REFERENCES forum_questions(id) ON DELETE CASCADE,
  lawyer_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  answer       TEXT NOT NULL,
  upvotes      INTEGER DEFAULT 0,
  is_accepted  BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_vault (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id  UUID REFERENCES bookings(id) ON DELETE SET NULL,
  name        VARCHAR(300) NOT NULL,
  file_type   VARCHAR(20) DEFAULT 'pdf',
  size        VARCHAR(30),
  encrypted   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Add referral columns to users if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code     VARCHAR(30) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by       UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_count    INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_earnings INTEGER DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════════════
-- SPRINT 1 — New production tables
-- ═══════════════════════════════════════════════════════════════════════

-- OTP codes for phone verification
CREATE TABLE IF NOT EXISTS otp_codes (
  id          SERIAL PRIMARY KEY,
  phone       VARCHAR(255) NOT NULL,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  code        VARCHAR(6) NOT NULL,
  purpose     VARCHAR(30) DEFAULT 'verify',   -- verify | login | reset
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  attempts    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Firebase push notification tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   VARCHAR(10) DEFAULT 'web',      -- web | ios | android
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- File uploads (S3/R2 metadata)
CREATE TABLE IF NOT EXISTS file_uploads (
  id           SERIAL PRIMARY KEY,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  booking_id   UUID REFERENCES bookings(id) ON DELETE SET NULL,
  original_name VARCHAR(300),
  stored_name  VARCHAR(300),
  mime_type    VARCHAR(100),
  size_bytes   INTEGER,
  bucket       VARCHAR(100),
  key          VARCHAR(500),
  url          TEXT,
  encrypted    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Security audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id         SERIAL PRIMARY KEY,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(100) NOT NULL,
  entity     VARCHAR(50),
  entity_id  VARCHAR(100),
  ip         VARCHAR(45),
  user_agent TEXT,
  meta       JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- JWT token blacklist (logout)
CREATE TABLE IF NOT EXISTS blacklist_tokens (
  id         SERIAL PRIMARY KEY,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blacklist_expires ON blacklist_tokens(expires_at);

-- Lawyer availability slots
CREATE TABLE IF NOT EXISTS lawyer_availability (
  id          SERIAL PRIMARY KEY,
  lawyer_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL,             -- 0=Sun … 6=Sat
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lawyer_id, day_of_week, start_time)
);

-- Video consultation rooms
CREATE TABLE IF NOT EXISTS consultation_rooms (
  id           SERIAL PRIMARY KEY,
  booking_id   UUID REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,
  provider     VARCHAR(20) DEFAULT 'daily',  -- daily | jitsi | zoom
  room_name    VARCHAR(200),
  room_url     TEXT,
  token_client TEXT,
  token_lawyer TEXT,
  started_at   TIMESTAMPTZ,
  ended_at     TIMESTAMPTZ,
  duration_min INTEGER,
  recording_url TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Installment payment plans
CREATE TABLE IF NOT EXISTS installments (
  id           SERIAL PRIMARY KEY,
  booking_id   UUID REFERENCES bookings(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  total_amount NUMERIC(10,2) NOT NULL,
  paid_amount  NUMERIC(10,2) DEFAULT 0,
  installments INTEGER NOT NULL,
  interval_days INTEGER DEFAULT 30,
  next_due_at  TIMESTAMPTZ,
  status       VARCHAR(20) DEFAULT 'active', -- active | completed | defaulted
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Installment payments
CREATE TABLE IF NOT EXISTS installment_payments (
  id              SERIAL PRIMARY KEY,
  installment_id  INTEGER REFERENCES installments(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL,
  paymob_order_id VARCHAR(100),
  status          VARCHAR(20) DEFAULT 'pending',
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id            SERIAL PRIMARY KEY,
  booking_id    UUID REFERENCES bookings(id) ON DELETE SET NULL,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  lawyer_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  invoice_no    VARCHAR(30) UNIQUE,
  amount        NUMERIC(10,2) NOT NULL,
  tax_amount    NUMERIC(10,2) DEFAULT 0,
  total_amount  NUMERIC(10,2) NOT NULL,
  status        VARCHAR(20) DEFAULT 'issued',  -- issued | paid | cancelled
  issued_at     TIMESTAMPTZ DEFAULT NOW(),
  due_at        TIMESTAMPTZ,
  paid_at       TIMESTAMPTZ
);

-- Email logs
CREATE TABLE IF NOT EXISTS email_logs (
  id          SERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  to_email    VARCHAR(200) NOT NULL,
  subject     VARCHAR(300) NOT NULL,
  template    VARCHAR(100),
  status      VARCHAR(20) DEFAULT 'sent',    -- sent | failed | bounced
  provider    VARCHAR(20),
  provider_id VARCHAR(200),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- SMS logs
CREATE TABLE IF NOT EXISTS sms_logs (
  id          SERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  to_phone    VARCHAR(20) NOT NULL,
  message     TEXT,
  status      VARCHAR(20) DEFAULT 'sent',
  provider    VARCHAR(20),
  provider_id VARCHAR(200),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Phone verification flag on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified   BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified   BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at   TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online        BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url       TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio              TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_enabled   BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_secret    VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;

-- Sprint 7 additions
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned   BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason  TEXT;
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS verified_at         TIMESTAMPTZ;
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS rejection_reason    TEXT;
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS is_visible          BOOLEAN DEFAULT true;
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS subscription_plan   VARCHAR(20) DEFAULT 'basic';
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS service_prices      JSONB;
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS has_set_schedule    BOOLEAN DEFAULT false;
ALTER TABLE bookings        ADD COLUMN IF NOT EXISTS reminder_sent       BOOLEAN DEFAULT false;
ALTER TABLE bookings        ADD COLUMN IF NOT EXISTS cancel_reason       TEXT;
ALTER TABLE bookings        ADD COLUMN IF NOT EXISTS payment_status      VARCHAR(20) DEFAULT 'unpaid';

-- Sprint 8 — Broadcast/MyRequests + Jobs tables
CREATE TABLE IF NOT EXISTS broadcast_requests (
  id           SERIAL PRIMARY KEY,
  client_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL,
  category     VARCHAR(100),
  description  TEXT,
  budget       VARCHAR(50),
  urgency      VARCHAR(20) DEFAULT 'normal',
  city         VARCHAR(100),
  status       VARCHAR(20) DEFAULT 'active',  -- active|closed|expired
  expires_at   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broadcast_bids (
  id              SERIAL PRIMARY KEY,
  request_id      INTEGER REFERENCES broadcast_requests(id) ON DELETE CASCADE,
  lawyer_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  price           NUMERIC(10,2),
  note            TEXT,
  status          VARCHAR(20) DEFAULT 'pending', -- pending|accepted|rejected
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, lawyer_id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(200) NOT NULL,
  company      VARCHAR(200) NOT NULL,
  location     VARCHAR(200),
  type         VARCHAR(50) DEFAULT 'Full-time',
  salary_min   INTEGER,
  salary_max   INTEGER,
  description  TEXT,
  requirements JSONB DEFAULT '[]',
  urgent       BOOLEAN DEFAULT false,
  is_active    BOOLEAN DEFAULT true,
  posted_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_applications (
  id           SERIAL PRIMARY KEY,
  job_id       INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  cover_letter TEXT,
  status       VARCHAR(20) DEFAULT 'pending',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, user_id)
);

-- ═══════════════════════════════════════════════════════════════
-- SPRINT 9 — Indexes, seed data, security, performance
-- ═══════════════════════════════════════════════════════════════

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_bookings_lawyer_date    ON bookings(lawyer_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_bookings_client2        ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status         ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created   ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_payments_booking2       ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_user2          ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_lawyer          ON reviews(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user2         ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_city    ON lawyer_profiles(city);
CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_spec    ON lawyer_profiles(specialization);
CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_rating  ON lawyer_profiles(rating DESC);
CREATE INDEX IF NOT EXISTS idx_users_role              ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email2            ON users(email);
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone         ON otp_codes(phone, purpose);
CREATE INDEX IF NOT EXISTS idx_broadcast_client        ON broadcast_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_status        ON broadcast_requests(status);
