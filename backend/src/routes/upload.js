const router  = require('express').Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { uploadFile, multerMiddleware } = require('../utils/storage');

const upload = multerMiddleware({ maxSize: 10 * 1024 * 1024 });

// POST /api/upload — upload a file
router.post('/', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    const { bookingId, folder = 'general' } = req.body;
    const result = await uploadFile({
      buffer:       req.file.buffer,
      originalName: req.file.originalname,
      mimeType:     req.file.mimetype,
      userId:       req.user.id,
      folder,
    });

    // Save metadata to DB
    const { rows: [record] } = await pool.query(
      `INSERT INTO file_uploads
         (user_id, booking_id, original_name, stored_name, mime_type, size_bytes, bucket, key, url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.id, bookingId||null, req.file.originalname, result.key,
       req.file.mimetype, req.file.size, result.bucket, result.key, result.url]
    );

    // Also save to document_vault if it's a vault upload
    if (folder === 'vault') {
      await pool.query(
        `INSERT INTO document_vault (user_id, booking_id, name, file_type, size, encrypted)
         VALUES ($1,$2,$3,$4,$5,true)`,
        [req.user.id, bookingId||null, req.file.originalname,
         req.file.originalname.split('.').pop().toLowerCase(),
         `${(req.file.size/1024).toFixed(0)} KB`]
      );
    }

    res.status(201).json({ file: record, url: result.url });
  } catch (err) { next(err); }
});

// POST /api/upload/multiple — upload multiple files
router.post('/multiple', requireAuth, upload.array('files', 10), async (req, res, next) => {
  try {
    if (!req.files?.length) return res.status(400).json({ message: 'No files provided' });

    const { bookingId, folder = 'general' } = req.body;
    const results = [];

    for (const file of req.files) {
      const result = await uploadFile({
        buffer: file.buffer, originalName: file.originalname,
        mimeType: file.mimetype, userId: req.user.id, folder,
      });
      const { rows: [record] } = await pool.query(
        `INSERT INTO file_uploads (user_id, booking_id, original_name, mime_type, size_bytes, bucket, key, url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [req.user.id, bookingId||null, file.originalname, file.mimetype, file.size, result.bucket, result.key, result.url]
      );
      results.push({ file: record, url: result.url });
    }

    res.status(201).json({ files: results });
  } catch (err) { next(err); }
});

module.exports = router;
