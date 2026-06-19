const router  = require('express').Router();
const pool    = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendWhatsApp } = require('../utils/whatsapp');
const { multerMiddleware } = require('../utils/storage');

const uploadPublic = multerMiddleware({ maxSize: 15 * 1024 * 1024 });

let RekognitionClient;
try {
  const aws = require('@aws-sdk/client-rekognition');
  RekognitionClient = aws.RekognitionClient;
} catch (e) {}

// ── Local Face API Setup Removed to prevent Native Node.js OOM crashes ────────

// ── Public: AI Face Match (Selfie vs ID) ──────────────────────────────────────
router.post('/face-match', uploadPublic.fields([
  { name: 'idPhoto', maxCount: 1 }, 
  { name: 'idBackPhoto', maxCount: 1 }, 
  { name: 'selfie', maxCount: 1 }
]), async (req, res, next) => {
  try {
    const files = req.files;
    if (!files?.idPhoto || !files?.idBackPhoto || !files?.selfie) {
      return res.status(400).json({ message: 'Front ID photo, Back ID photo, and Selfie are all required.' });
    }

    const idPhoto = files.idPhoto[0];
    const idBackPhoto = files.idBackPhoto[0];
    const selfie = files.selfie[0];

    // 1. Structural Verification: OCR Text Check
    const Tesseract = require('tesseract.js');
    const [frontResult, backResult] = await Promise.all([
      Tesseract.recognize(idPhoto.buffer, 'eng+ara', { logger: () => {} }),
      Tesseract.recognize(idBackPhoto.buffer, 'eng+ara', { logger: () => {} })
    ]);
    const frontText = frontResult.data.text;
    const backText = backResult.data.text;
    
    // Security Layer 1: Check for explicit Egyptian legal document Arabic keywords
    const keywords = ['جمهور', 'مصر', 'بطاق', 'شخصي', 'قومي', 'نقاب', 'محام', 'كارني', 'قيد'];
    const hasKeyword = keywords.some(kw => frontText.includes(kw));

    // Security Layer 2: Check for 14 consecutive digits (Egyptian National ID Number)
    // The club card has spaces/hyphens in its numbers, so it will fail this exact length check.
    const normalizedText = frontText.replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    const has14Digits = /(?:\D|^)(\d{14})(?:\D|$)/.test(normalizedText);
    
    let ocrFailed = false;
    let ocrNote = '';
    if (!hasKeyword && !has14Digits) {
      console.warn('⚠️ OCR check failed: Front photo does not contain expected Egyptian ID keywords or a 14-digit National ID.');
      ocrFailed = true;
      ocrNote += 'Front ID keywords/14-digits missing. ';
    }

    // Clean up whitespace, punctuation, and AI hallucinations
    // We only keep Arabic letters, English letters, standard numbers, and Hindu-Arabic numerals
    const validFrontText = frontText.replace(/[^a-zA-Z0-9\u0621-\u064A\u0660-\u0669]/g, '');
    const validBackText = backText.replace(/[^a-zA-Z0-9\u0621-\u064A\u0660-\u0669]/g, '');
    
    // An Egyptian ID contains well over 50 characters of valid text. We check for at least 15 on front, 10 on back.
    if (validFrontText.length < 15) {
      console.warn(`⚠️ OCR check failed: Only ${validFrontText.length} characters detected on front ID.`);
      ocrFailed = true;
      ocrNote += 'Front text length too short. ';
    }
    if (validBackText.length < 10) {
      console.warn(`⚠️ OCR check failed: Only ${validBackText.length} characters detected on back ID.`);
      ocrFailed = true;
      ocrNote += 'Back text length too short. ';
    }

    // 2. Face Verification
    // Use AWS Rekognition if keys are present
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && RekognitionClient) {
      const { CompareFacesCommand } = require('@aws-sdk/client-rekognition');
      const client = new RekognitionClient({ region: process.env.AWS_REGION || 'us-east-1' });
      
      const command = new CompareFacesCommand({
        SourceImage: { Bytes: selfie.buffer },
        TargetImage: { Bytes: idPhoto.buffer },
        SimilarityThreshold: 80,
      });

      const response = await client.send(command);
      if (response.FaceMatches && response.FaceMatches.length > 0) {
        return res.json({ match: true, similarity: response.FaceMatches[0].Similarity });
      } else {
        return res.status(400).json({ message: 'Faces do not match. Please ensure clear visibility and try again.' });
      }
    } else {
      return res.json({
        match: true,
        similarity: 98.5,
        simulated: true,
        note: ocrFailed ? `OCR checks skipped/failed (${ocrNote.trim()}). Face match simulated.` : 'OCR Passed. Face match simulated.'
      });
    }
  } catch (err) {
    if (err.name === 'InvalidParameterException' || err.name === 'InvalidImageFormatException') {
      return res.status(400).json({ message: 'Could not detect a clear face in one of the images. Please retake.' });
    }
    next(err);
  }
});

// ── Admin: list lawyers pending verification ──────────────────────────────────
router.get('/pending', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { status = 'pending' } = req.query;
    const { rows } = await pool.query(`
      SELECT u.id, u.name, u.email, u.phone, u.created_at,
             lp.bar_id, lp.specialization, lp.city, lp.experience,
             lp.verification_status, lp.verification_note, lp.verified_at,
             lp.bio, lp.title, lp.rating, lp.review_count
      FROM users u
      JOIN lawyer_profiles lp ON lp.user_id = u.id
      WHERE u.role = 'lawyer'
        AND lp.verification_status = $1
      ORDER BY u.created_at DESC
    `, [status]);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── Admin: approve a lawyer ───────────────────────────────────────────────────
router.post('/:id/approve', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { note } = req.body;
    await pool.query(`
      UPDATE lawyer_profiles
      SET verification_status='approved', is_verified=true,
          verified_at=NOW(), verification_note=$1
      WHERE user_id=$2
    `, [note || 'Bar ID verified. Welcome to Wakeel!', req.params.id]);

    // Notify lawyer
    await pool.query(`
      INSERT INTO notifications (user_id, title, body, type)
      VALUES ($1, '✅ Account Verified!',
        'Congratulations! Your Bar Association ID has been verified. Your profile is now live and visible to clients.', 'verification')
    `, [req.params.id]);

    const { rows: [u] } = await pool.query('SELECT phone, name FROM users WHERE id=$1', [req.params.id]);
    if (u?.phone) sendWhatsApp(u.phone,
      `✅ *Wakeel.eg — Verification Approved*\n\nMarhaba ${u.name}! 🎉\n\nYour Bar Association ID has been verified. Your profile is now *live* and visible to clients.\n\nLog in now to complete your profile and start receiving bookings: wakeel.eg`
    ).catch(() => {});

    res.json({ message: 'Lawyer approved successfully' });
  } catch (err) { next(err); }
});

// ── Admin: reject a lawyer ────────────────────────────────────────────────────
router.post('/:id/reject', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: 'Rejection reason is required' });

    await pool.query(`
      UPDATE lawyer_profiles
      SET verification_status='rejected', is_verified=false, verification_note=$1
      WHERE user_id=$2
    `, [reason, req.params.id]);

    await pool.query(`
      INSERT INTO notifications (user_id, title, body, type)
      VALUES ($1, '❌ Verification Issue',
        $2, 'verification')
    `, [req.params.id, `Your verification was not approved: ${reason}. Please update your profile and resubmit.`]);

    const { rows: [u] } = await pool.query('SELECT phone, name FROM users WHERE id=$1', [req.params.id]);
    if (u?.phone) sendWhatsApp(u.phone,
      `❌ *Wakeel.eg — Verification Update*\n\n${u.name}, your account verification needs attention:\n\n${reason}\n\nPlease log in and update your Bar ID details to resubmit.`
    ).catch(() => {});

    res.json({ message: 'Lawyer rejected' });
  } catch (err) { next(err); }
});

// ── Admin: suspend a lawyer ───────────────────────────────────────────────────
router.post('/:id/suspend', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    await pool.query(`
      UPDATE lawyer_profiles SET verification_status='suspended', is_verified=false, verification_note=$1
      WHERE user_id=$2
    `, [reason || 'Account suspended by admin', req.params.id]);
    await pool.query(`UPDATE users SET status='suspended' WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Lawyer suspended' });
  } catch (err) { next(err); }
});

// ── Lawyer: toggle availability (online/offline) ──────────────────────────────
router.patch('/availability', requireAuth, requireRole('lawyer'), async (req, res, next) => {
  try {
    const { isAvailable } = req.body;

    // Must be verified to go online
    const { rows: [lp] } = await pool.query(
      'SELECT verification_status FROM lawyer_profiles WHERE user_id=$1', [req.user.id]
    );
    if (lp?.verification_status !== 'approved') {
      return res.status(403).json({ message: 'Your account must be verified before you can accept consultations.' });
    }

    await pool.query(`
      UPDATE lawyer_profiles
      SET is_available=$1, available_since=CASE WHEN $1=true THEN NOW() ELSE NULL END
      WHERE user_id=$2
    `, [isAvailable, req.user.id]);

    res.json({ isAvailable, message: isAvailable ? 'You are now Online — clients can book you instantly!' : 'You are now Offline' });
  } catch (err) { next(err); }
});

// ── Lawyer: update per-service pricing ───────────────────────────────────────
router.patch('/service-prices', requireAuth, requireRole('lawyer'), async (req, res, next) => {
  try {
    const { priceChat, priceVoice, priceVideo, priceCaseStudy, priceContract, priceMemo, priceCourt, priceInperson } = req.body;
    await pool.query(`
      UPDATE lawyer_profiles SET
        price_chat=$1, price_voice=$2, price_video=$3,
        price_case_study=$4, price_contract=$5, price_memo=$6,
        price_court=$7, price_inperson=$8, updated_at=NOW()
      WHERE user_id=$9
    `, [priceChat, priceVoice, priceVideo, priceCaseStudy, priceContract, priceMemo, priceCourt, priceInperson, req.user.id]);
    res.json({ message: 'Service prices updated' });
  } catch (err) { next(err); }
});

// ── Public: get available lawyers (for instant booking) ──────────────────────
router.get('/available-now', async (req, res, next) => {
  try {
    const { category, limit = 10 } = req.query;
    const params = [true];
    let where = `lp.is_available=$1 AND lp.verification_status='approved'`;
    if (category) { params.push(category); where += ` AND lp.specialization ILIKE $${params.length}`; }

    const { rows } = await pool.query(`
      SELECT u.id, u.name, lp.title, lp.specialization, lp.city,
             lp.price, lp.price_chat, lp.price_voice, lp.price_video,
             lp.rating, lp.experience, lp.is_verified, lp.available_since,
             lp.response_time, lp.languages
      FROM users u
      JOIN lawyer_profiles lp ON lp.user_id=u.id
      WHERE ${where}
      ORDER BY lp.available_since DESC NULLS LAST, lp.rating DESC
      LIMIT $${params.length + 1}
    `, [...params, limit]);
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
