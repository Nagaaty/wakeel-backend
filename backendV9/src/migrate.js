/**
 * ─── Wakeel — Unified Migration System ───────────────────────────────────────
 *
 * HOW IT WORKS:
 *   1. On server start, this module checks a `schema_migrations` table.
 *   2. Each migration has a unique version string (e.g. "001_core_columns").
 *   3. If a version has already run, it is SKIPPED — zero DB round-trips.
 *   4. Only new/pending migrations run.
 *
 * RESULT:
 *   • First boot: runs all pending migrations (~40 queries, batched into groups)
 *   • Every subsequent restart: 1 fast SELECT to check versions, then done.
 *   • No more 30–40 slow ALTER TABLE warnings on every nodemon reload.
 *
 * TO ADD A NEW MIGRATION:
 *   Add a new object to the MIGRATIONS array with a unique `version` string
 *   and an array of SQL statements. NEVER edit existing migrations — always add.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const pool = require('./config/db');

// ─── Migration definitions ─────────────────────────────────────────────────
// Each entry: { version: string (unique, sortable), sql: string[] }
// SQL statements within one migration run sequentially.
// Failures are caught per-statement — one failure doesn't block the rest.
const MIGRATIONS = [

  {
    version: '001_users_core_columns',
    sql: [
      `ALTER TABLE otp_codes ALTER COLUMN phone TYPE VARCHAR(255)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ`,
    ],
  },

  {
    version: '002_lawyer_profiles_columns',
    sql: [
      `ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS consultation_fee INTEGER DEFAULT 400`,
      `ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2) DEFAULT 0`,
      `ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0`,
      `ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0`,
      `ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0`,
      `ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS losses INTEGER DEFAULT 0`,
      `ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS bar_number VARCHAR(50)`,
      `ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS response_time_hours INTEGER`,
      `ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true`,
      `ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false`,
      `ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(20) DEFAULT 'basic'`,
      `ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS service_prices JSONB`,
      `ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS has_set_schedule BOOLEAN DEFAULT false`,
      `ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS karma_score INTEGER DEFAULT 0`,
      `ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS accepted_answers INTEGER DEFAULT 0`,
    ],
  },

  {
    version: '003_market_trends_table',
    sql: [
      `CREATE TABLE IF NOT EXISTS market_trends (
        id          SERIAL PRIMARY KEY,
        category    VARCHAR(255) NOT NULL,
        post_count  INTEGER DEFAULT 0,
        likes_count INTEGER DEFAULT 0,
        recorded_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    ],
  },

  {
    version: '004_forum_social_columns',
    sql: [
      `ALTER TABLE forum_questions ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0`,
      `ALTER TABLE forum_questions ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0`,
      `ALTER TABLE forum_questions ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)`,
      `ALTER TABLE forum_questions ADD COLUMN IF NOT EXISTS liked_by JSONB DEFAULT '[]'`,
      `ALTER TABLE forum_questions ADD COLUMN IF NOT EXISTS dislikes_count INTEGER DEFAULT 0`,
      `ALTER TABLE forum_questions ADD COLUMN IF NOT EXISTS disliked_by JSONB DEFAULT '[]'`,
      `ALTER TABLE forum_questions ADD COLUMN IF NOT EXISTS original_post_id INTEGER`,
      `ALTER TABLE forum_questions ADD COLUMN IF NOT EXISTS original_post_data JSONB`,
      `ALTER TABLE forum_questions ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'`,
      `ALTER TABLE forum_answers ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0`,
      `ALTER TABLE forum_answers ADD COLUMN IF NOT EXISTS liked_by JSONB DEFAULT '[]'`,
      `ALTER TABLE forum_answers ADD COLUMN IF NOT EXISTS parent_answer_id INT REFERENCES forum_answers(id)`,
    ],
  },

  {
    version: '005_forum_saved_table',
    sql: [
      `CREATE TABLE IF NOT EXISTS forum_saved (
        user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
        question_id INT  REFERENCES forum_questions(id) ON DELETE CASCADE,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, question_id)
      )`,
    ],
  },

  {
    version: '006_reviews_columns',
    sql: [
      `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS outcome VARCHAR(50)`,
      `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true`,
    ],
  },

  {
    version: '007_bookings_columns',
    sql: [
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'`,
      `ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_type_check`,
    ],
  },

  {
    version: '008_subscriptions_notifications',
    sql: [
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewal_warning_sent BOOLEAN DEFAULT false`,
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT DEFAULT '#'`,
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB`,
    ],
  },

  {
    version: '009_consultation_rooms_table',
    sql: [
      `CREATE TABLE IF NOT EXISTS consultation_rooms (
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
      )`,
    ],
  },

  {
    version: '010_jobs_tables',
    sql: [
      `CREATE TABLE IF NOT EXISTS jobs (
        id          SERIAL PRIMARY KEY,
        title       VARCHAR(255) NOT NULL,
        description TEXT,
        location    VARCHAR(255),
        type        VARCHAR(50),
        salary      VARCHAR(100),
        category    VARCHAR(100),
        user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
        is_active   BOOLEAN DEFAULT true,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS job_applications (
        id         SERIAL PRIMARY KEY,
        job_id     INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
        user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
        message    TEXT,
        status     VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(job_id, user_id)
      )`,
      `ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS cv_url TEXT DEFAULT ''`,
      `CREATE TABLE IF NOT EXISTS job_saves (
        user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
        job_id     INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, job_id)
      )`,
    ],
  },

  {
    version: '011_lawyer_schedule_tables',
    sql: [
      `ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS has_set_schedule BOOLEAN DEFAULT false`,
      `ALTER TABLE lawyer_availability ADD COLUMN IF NOT EXISTS end_time VARCHAR(5)`,
      `CREATE TABLE IF NOT EXISTS lawyer_schedule_overrides (
        id          SERIAL PRIMARY KEY,
        lawyer_id   UUID REFERENCES users(id) ON DELETE CASCADE,
        date        DATE NOT NULL,
        is_off      BOOLEAN DEFAULT false,
        slots       JSONB DEFAULT '[]',
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )`,
      `ALTER TABLE lawyer_schedule_overrides ADD COLUMN IF NOT EXISTS service_types JSONB DEFAULT '["consultation"]'`,
      `CREATE TABLE IF NOT EXISTS lawyer_service_defaults (
        id          SERIAL PRIMARY KEY,
        lawyer_id   UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        services    JSONB DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )`,
    ],
  },

  {
    version: '012_data_fixes',
    sql: [
      // Fix ghost lawyers whose is_visible was never set
      `UPDATE lawyer_profiles SET is_visible = true WHERE is_visible IS NULL`,
    ],
  },

  {
    version: '013_bookings_indexes',
    sql: [
      // Speed up the heavy GET /api/bookings query — filters by client_id or lawyer_id + sorts by scheduled_at
      `CREATE INDEX IF NOT EXISTS idx_bookings_client_scheduled ON bookings (client_id, scheduled_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_lawyer_scheduled ON bookings (lawyer_id, scheduled_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status)`,
      // Speed up forum feed
      `CREATE INDEX IF NOT EXISTS idx_forum_questions_created ON forum_questions (created_at DESC) WHERE is_visible = true`,
      `CREATE INDEX IF NOT EXISTS idx_forum_questions_likes ON forum_questions (likes_count DESC) WHERE is_visible = true`,
    ],
  },

  {
    version: '014_laws_library',
    sql: [
      `CREATE TABLE IF NOT EXISTS laws (
        id SERIAL PRIMARY KEY,
        law_id VARCHAR(50) UNIQUE,
        law_name VARCHAR(255),
        law_name_en VARCHAR(255),
        article_number VARCHAR(100),
        article_number_en VARCHAR(100),
        content TEXT,
        content_en TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_laws_search ON laws (law_name, article_number)`,
      
      // Seed initial 7 verbatim laws
      `INSERT INTO laws (law_id, law_name, law_name_en, article_number, article_number_en, content, content_en) VALUES
      ('civil_1', 'القانون المدني (رقم 131 لسنة 1948)', 'Civil Code', 'مادة 1', 'Article 1', 'تسري النصوص التشريعية على جميع المسائل التي تتناولها هذه النصوص في لفظها أو في فحواها. فإذا لم يوجد نص تشريعي يمكن تطبيقه، حكم القاضي بمقتضى العرف، فإذا لم يوجد، فبمقتضى مبادئ الشريعة الإسلامية، فإذا لم توجد، فبمقتضى مبادئ القانون الطبيعي وقواعد العدالة.', 'Legislative provisions govern all matters to which these provisions apply in letter or spirit. In the absence of a legislative provision, the judge shall decide according to custom, and in the absence of custom, according to the principles of Islamic Sharia.'),
      ('civil_44', 'القانون المدني (رقم 131 لسنة 1948)', 'Civil Code', 'مادة 44', 'Article 44', 'كل شخص يبلغ سن الرشد متمتعاً بقواه العقلية، ولم يحجر عليه، يكون كامل الأهلية لمباشرة حقوقه المدنية.', 'Every person who has attained the age of majority, is of sound mind, and has not been interdicted, has full capacity to exercise his civil rights.'),
      ('civil_147', 'القانون المدني (رقم 131 لسنة 1948)', 'Civil Code', 'مادة 147', 'Article 147', 'العقد شريعة المتعاقدين، فلا يجوز نقضه ولا تعديله إلا باتفاق الطرفين، أو للأسباب التي يقررها القانون.', 'The contract makes the law of the parties. It can be revoked or altered only by mutual consent of the parties or for reasons provided for by the law.'),
      ('civil_148', 'القانون المدني (رقم 131 لسنة 1948)', 'Civil Code', 'مادة 148', 'Article 148', 'يجب تنفيذ العقد طبقاً لما اشتمل عليه وبطريقة تتفق مع ما يوجبه حسن النية.', 'A contract must be performed in accordance with its contents and in compliance with the requirements of good faith.'),
      ('civil_163', 'القانون المدني (رقم 131 لسنة 1948)', 'Civil Code', 'مادة 163', 'Article 163', 'كل خطأ سبب ضرراً للغير يلزم من ارتكبه بالتعويض.', 'Every fault which causes injury to another imposes an obligation to make reparation upon the person by whom it is committed.'),
      ('penal_234', 'قانون العقوبات (رقم 58 لسنة 1937)', 'Penal Code', 'مادة 234', 'Article 234', 'من قتل نفساً عمداً من غير سبق إصرار ولا ترصد يعاقب بالسجن المؤبد أو المشدد.', 'Whoever intentionally kills a person without premeditation or lying in wait shall be punished with life or aggravated imprisonment.'),
      ('penal_311', 'قانون العقوبات (رقم 58 لسنة 1937)', 'Penal Code', 'مادة 311', 'Article 311', 'كل من اختلس منقولا مملوكا لغيره فهو سارق.', 'Whoever embezzles a movable property belonging to another is a thief.'),
      ('cyber_25', 'مكافحة جرائم تقنية المعلومات (175 لسنة 2018)', 'Cybercrimes Law', 'مادة 25', 'Article 25', 'يعاقب بالحبس مدة لا تقل عن ستة أشهر، وبغرامة لا تقل عن خمسين ألف جنيه ولا تجاوز مائة ألف جنيه، أو بإحدى هاتين العقوبتين، كل من اعتدى على أي من المبادئ أو القيم الأسرية في المجتمع المصري، أو انتهك حرمة الحياة الخاصة.', 'Punishable by imprisonment for at least 6 months and a fine between 50,000 and 100,000 EGP, or either penalty, for anyone who violates Egyptian family principles or values, or breaches the privacy of an individual.')
      ON CONFLICT (law_id) DO NOTHING`
    ],
  },

  {
    version: '015_crm_client_notes',
    sql: [
      `CREATE TABLE IF NOT EXISTS lawyer_client_notes (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        lawyer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        notes       TEXT,
        urgency     VARCHAR(20) DEFAULT 'normal' CHECK (urgency IN ('urgent','normal','low')),
        updated_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(lawyer_id, client_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_lawyer_client_notes ON lawyer_client_notes (lawyer_id, client_id)`
    ],
  },
];

// ─── Runner ────────────────────────────────────────────────────────────────
async function runMigrations() {
  const start = Date.now();

  // 1. Ensure the tracking table exists (always safe — uses IF NOT EXISTS)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    VARCHAR(100) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // 2. Fetch already-applied versions in one query
  const { rows } = await pool.query('SELECT version FROM schema_migrations');
  const applied = new Set(rows.map(r => r.version));

  // 3. Run only pending migrations
  const pending = MIGRATIONS.filter(m => !applied.has(m.version));

  if (pending.length === 0) {
    console.log(`✅ DB schema up-to-date (${MIGRATIONS.length} migrations, 0 pending) — ${Date.now() - start}ms`);
    return;
  }

  console.log(`🔄 Running ${pending.length} pending DB migration(s)…`);

  for (const migration of pending) {
    const t = Date.now();
    let failed = 0;
    for (const sql of migration.sql) {
      try {
        await pool.query(sql);
      } catch (err) {
        // Log but don't crash — column-already-exists errors are expected
        // on first run after a partial migration attempt.
        console.warn(`  ⚠️  [${migration.version}] skipped statement: ${err.message.slice(0, 80)}`);
        failed++;
      }
    }
    // Mark migration as applied even if some statements were skipped
    // (IF NOT EXISTS errors are harmless)
    await pool.query(
      'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING',
      [migration.version]
    );
    const status = failed > 0 ? `⚠️ (${failed} skipped)` : '✅';
    console.log(`  ${status} ${migration.version} — ${Date.now() - t}ms`);
  }

  console.log(`🚀 Migrations complete — ${Date.now() - start}ms total`);
}

module.exports = { runMigrations };
