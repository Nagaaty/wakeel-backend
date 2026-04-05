// ─── File Storage — Cloudflare R2 (primary) + Local fallback ──────────────────
// R2 is S3-compatible, no egress fees, very cheap (~$0.015/GB)
// Setup:
//   R2_ACCOUNT_ID=your_cf_account_id
//   R2_ACCESS_KEY_ID=your_key
//   R2_SECRET_ACCESS_KEY=your_secret
//   R2_BUCKET=wakeel-files
//   R2_PUBLIC_URL=https://files.wakeel.eg  (or your R2 public URL)
//
// Falls back to local disk storage if R2 not configured

const fs   = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

let s3Client = null;

function getS3() {
  if (s3Client) return s3Client;
  if (!process.env.R2_ACCOUNT_ID) return null;
  try {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    return s3Client;
  } catch { return null; }
}

const LOCAL_UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(LOCAL_UPLOAD_DIR)) fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });

// Upload a file (buffer or stream)
async function uploadFile({ buffer, originalName, mimeType, userId, folder = 'general' }) {
  const ext       = path.extname(originalName);
  const storedKey = `${folder}/${userId}/${uuid()}${ext}`;

  const s3 = getS3();
  if (s3) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await s3.send(new PutObjectCommand({
      Bucket:      process.env.R2_BUCKET || 'wakeel-files',
      Key:         storedKey,
      Body:        buffer,
      ContentType: mimeType,
    }));
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${storedKey}`;
    return { url: publicUrl, key: storedKey, bucket: process.env.R2_BUCKET, provider: 'r2' };
  }

  // Local fallback
  const localPath = path.join(LOCAL_UPLOAD_DIR, storedKey.replace(/\//g, '_'));
  fs.writeFileSync(localPath, buffer);
  const base = process.env.BASE_URL || process.env.FRONTEND_URL?.replace(':3000', ':5000') || 'https://wakeel-api.onrender.com';
  const url = `${base}/uploads/${path.basename(localPath)}`;
  return { url, key: storedKey, bucket: 'local', provider: 'local' };
}

// Get a signed URL for private access
async function getSignedUrl(key, expiresIn = 3600) {
  const s3 = getS3();
  if (s3) {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl: awsGetSignedUrl } = require('@aws-sdk/s3-request-presigner');
    return awsGetSignedUrl(s3, new GetObjectCommand({
      Bucket: process.env.R2_BUCKET || 'wakeel-files',
      Key:    key,
    }), { expiresIn });
  }
  return `/uploads/${path.basename(key.replace(/\//g, '_'))}`;
}

// Delete a file
async function deleteFile(key) {
  const s3 = getS3();
  if (s3) {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
    return { deleted: true };
  }
  const localPath = path.join(LOCAL_UPLOAD_DIR, path.basename(key.replace(/\//g, '_')));
  if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
  return { deleted: true };
}

// Multer middleware for file uploads
function multerMiddleware(options = {}) {
  const multer = require('multer');
  const MAX_SIZE = options.maxSize || 10 * 1024 * 1024; // 10MB default
  const ALLOWED  = options.allowedTypes || [
    'image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/quicktime','video/x-msvideo','video/webm',
    'application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  return multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: MAX_SIZE },
    fileFilter: (req, file, cb) => {
      if (ALLOWED.includes(file.mimetype) || file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
      else cb(new Error(`File type not allowed: ${file.mimetype}`));
    },
  });
}

module.exports = { uploadFile, getSignedUrl, deleteFile, multerMiddleware };
