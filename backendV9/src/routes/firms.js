const router = require('express').Router();
const pool   = require('../config/db');
const { sendOTPEmail } = require('../utils/email');

// GET /api/firms - list firms with search/city filters
router.get('/', async (req, res, next) => {
  try {
    const { search, city, page = 1, limit = 20 } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(name ILIKE $${params.length} OR bio ILIKE $${params.length})`);
    }

    if (city) {
      const cityMap = {
        'القاهرة': 'Cairo', 'Cairo': 'Cairo',
        'الجيزة': 'Giza', 'Giza': 'Giza',
        'الإسكندرية': 'Alexandria', 'Alexandria': 'Alexandria',
        'القليوبية': 'Qalyubia', 'Qalyubia': 'Qalyubia',
        'الغربية': 'Gharbia', 'Gharbia': 'Gharbia',
        'المنوفية': 'Monufia', 'Monufia': 'Monufia',
        'الدقهلية': 'Dakahlia', 'Dakahlia': 'Dakahlia',
        'الشرقية': 'Sharqia', 'Sharqia': 'Sharqia',
        'البحيرة': 'Beheira', 'Beheira': 'Beheira',
        'دمياط': 'Damietta', 'Damietta': 'Damietta',
        'بورسعيد': 'Port Said', 'Port Said': 'Port Said',
        'الإسماعيلية': 'Ismailia', 'Ismailia': 'Ismailia',
        'السويس': 'Suez', 'Suez': 'Suez',
        'كفر الشيخ': 'Kafr El Sheikh', 'Kafr El Sheikh': 'Kafr El Sheikh',
        'الفيوم': 'Faiyum', 'Faiyum': 'Faiyum',
        'بني سويف': 'Beni Suef', 'Beni Suef': 'Beni Suef',
        'المنيا': 'Minya', 'Minya': 'Minya',
        'أسيوط': 'Asyut', 'Asyut': 'Asyut',
        'سوهاج': 'Sohag', 'Sohag': 'Sohag',
        'قنا': 'Qena', 'Qena': 'Qena',
        'الأقصر': 'Luxor', 'Luxor': 'Luxor',
        'أسوان': 'Aswan', 'Aswan': 'Aswan',
        'البحر الأحمر': 'Red Sea', 'Red Sea': 'Red Sea',
        'الوادي الجديد': 'New Valley', 'New Valley': 'New Valley',
        'مطروح': 'Matrouh', 'Matrouh': 'Matrouh',
        'شمال سيناء': 'North Sinai', 'North Sinai': 'North Sinai',
        'جنوب سيناء': 'South Sinai', 'South Sinai': 'South Sinai'
      };
      const dbCity = cityMap[city] || city;
      params.push(dbCity);
      conditions.push(`city ILIKE $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query total count
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM firms ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0].count);

    // Query list
    params.push(parseInt(limit));
    const limitPlaceholder = `$${params.length}`;
    params.push(offset);
    const offsetPlaceholder = `$${params.length}`;

    const firmsRes = await pool.query(`
      SELECT *
      FROM firms
      ${whereClause}
      ORDER BY rating DESC, created_at DESC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `, params);

    res.json({
      firms: firmsRes.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/firms/:id - single firm details
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const firmRes = await pool.query('SELECT * FROM firms WHERE id = $1', [id]);
    if (firmRes.rows.length === 0) {
      return res.status(404).json({ message: 'Law firm not found' });
    }
    res.json({ firm: firmRes.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/firms/:id/lawyers - list lawyers belonging to a specific firm
router.get('/:id/lawyers', async (req, res, next) => {
  try {
    const { id } = req.params;

    // First check if firm exists
    const firmCheck = await pool.query('SELECT id FROM firms WHERE id = $1', [id]);
    if (firmCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Law firm not found' });
    }

    const lawyersRes = await pool.query(`
      SELECT 
        lp.id, lp.specialization, lp.rating, lp.review_count, lp.experience, lp.price, 
        lp.bio, lp.city, lp.practitioner_type, lp.firm_id,
        u.name, u.email, u.phone, u.avatar_url
      FROM lawyer_profiles lp
      JOIN users u ON lp.user_id = u.id
      WHERE lp.firm_id = $1 AND lp.practitioner_type = 'firm_member' AND u.deleted_at IS NULL AND lp.is_visible IS NOT FALSE
      ORDER BY lp.rating DESC
    `, [id]);

    res.json({ lawyers: lawyersRes.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/firms/verify-code/:code - verify a firm join code
router.get('/verify-code/:code', async (req, res, next) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ message: 'Code is required' });
    }
    const { rows } = await pool.query(
      'SELECT id, name, city, is_verified FROM firms WHERE invite_code = $1',
      [code.toUpperCase().trim()]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Invalid invite code' });
    }
    res.json({ firm: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/firms - create/register a new firm on the fly (unverified by default)
router.post('/', async (req, res, next) => {
  try {
    const { name, city } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Firm name is required' });
    }

    const trimmedName = name.trim();

    // Check if firm name already exists to prevent duplicate entries
    const checkRes = await pool.query('SELECT * FROM firms WHERE name ILIKE $1', [trimmedName]);
    if (checkRes.rows.length > 0) {
      return res.status(400).json({
        message_en: 'A law firm with this name is already registered. Please join it using its invite code, or choose a different name.',
        message: 'هذه الشركة مسجلة بالفعل. يرجى الانضمام للشركة الحالية باستخدام كود الدعوة، أو اختيار اسم آخر.'
      });
    }

    // Generate unique 6-character alphanumeric invite code
    let inviteCode = '';
    while (true) {
      inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const codeCheck = await pool.query('SELECT id FROM firms WHERE invite_code = $1', [inviteCode]);
      if (codeCheck.rows.length === 0) break;
    }

    const insertRes = await pool.query(
      `INSERT INTO firms (name, city, is_verified, invite_code) VALUES ($1, $2, false, $3) RETURNING *`,
      [trimmedName, city || 'Cairo', inviteCode]
    );
    res.status(201).json({ firm: insertRes.rows[0], message: 'New firm created successfully' });
  } catch (err) {
    next(err);
  }
});

function getCleanDomain(url) {
  if (!url) return '';
  let domain = url.trim().toLowerCase();
  domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
  domain = domain.split('/')[0];
  return domain;
}

// POST /api/firms/send-verification - send verification code to professional email
router.post('/send-verification', async (req, res, next) => {
  try {
    const { firm_id, email } = req.body;
    if (!firm_id || !email) {
      return res.status(400).json({
        message_en: 'Firm ID and professional email are required.',
        message: 'معرف الشركة والبريد الإلكتروني المهني مطلوبان.'
      });
    }

    const { rows: [firm] } = await pool.query('SELECT * FROM firms WHERE id = $1', [firm_id]);
    if (!firm) {
      return res.status(404).json({
        message_en: 'Law firm not found.',
        message: 'لم يتم العثور على شركة المحاماة.'
      });
    }

    if (!firm.website) {
      return res.status(400).json({
        message_en: 'This firm does not have a website registered to verify email domains. Please use invite code or request to join.',
        message: 'لا تملك هذه الشركة موقعاً إلكترونياً مسجلاً للتحقق من النطاق. يرجى استخدام كود الدعوة أو طلب الانضمام.'
      });
    }

    // Extract domains
    const cleanFirmDomain = getCleanDomain(firm.website);
    const emailDomain = email.trim().toLowerCase().split('@')[1];

    if (!cleanFirmDomain || cleanFirmDomain !== emailDomain) {
      return res.status(400).json({
        message_en: `Your email domain (@${emailDomain}) does not match this firm's website domain (@${cleanFirmDomain}).`,
        message: `نطاق بريدك الإلكتروني (@${emailDomain}) لا يطابق نطاق موقع الشركة (@${cleanFirmDomain}).`
      });
    }

    // Generate 6-digit verification code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Save to otp_codes table
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await pool.query(
      `INSERT INTO otp_codes (phone, code, purpose, expires_at) 
       VALUES ($1, $2, 'firm_email_verify', $3)`,
      [email.trim().toLowerCase(), code, expiresAt]
    );

    // Send email using helper
    await sendOTPEmail({
      to: email.trim().toLowerCase(),
      name: firm.name,
      otp: code,
      purpose: 'verify'
    });

    res.json({ success: true, message: 'Verification code sent successfully.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/firms/verify-email-code - verify the 6-digit email code
router.post('/verify-email-code', async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({
        message_en: 'Email and code are required.',
        message: 'البريد الإلكتروني والرمز مطلوبان.'
      });
    }

    const { rows: [otpRecord] } = await pool.query(
      `SELECT * FROM otp_codes 
       WHERE phone = $1 AND code = $2 AND purpose = 'firm_email_verify' 
         AND expires_at > NOW() AND used_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [email.trim().toLowerCase(), code.trim()]
    );

    if (!otpRecord) {
      return res.status(400).json({
        message_en: 'Invalid or expired verification code.',
        message: 'رمز التحقق غير صحيح أو منتهي الصلاحية.'
      });
    }

    // Mark as used
    await pool.query(
      'UPDATE otp_codes SET used_at = NOW() WHERE id = $1',
      [otpRecord.id]
    );

    res.json({ success: true, message: 'Email verified successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
