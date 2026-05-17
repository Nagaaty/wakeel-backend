const jwt  = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'wakeel-dev-secret';

async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Authentication required' });

    // Check blacklist
    const crypto = require('crypto');
    const hash   = crypto.createHash('sha256').update(token).digest('hex');
    const { rows: [blacklisted] } = await pool.query(
      'SELECT id FROM blacklist_tokens WHERE token_hash=$1 AND expires_at > NOW()',
      [hash]
    ).catch(() => ({ rows: [] }));
    if (blacklisted) return res.status(401).json({ message: 'Token revoked — please log in again' });

    const decoded = jwt.verify(token, JWT_SECRET);

    // Check user still exists and not banned/deleted
    const { rows: [user] } = await pool.query(
      'SELECT id, role, name, email, phone, avatar_url, is_banned, deleted_at FROM users WHERE id=$1',
      [decoded.id]
    );
    if (!user)           return res.status(401).json({ message: 'User not found' });
    if (user.deleted_at) return res.status(401).json({ message: 'Account deleted' });
    if (user.is_banned)  return res.status(403).json({ message: 'Account suspended — contact support' });

    req.user = { ...decoded, ...user };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ message: 'Token expired — please log in again' });
    if (err.name === 'JsonWebTokenError') return res.status(401).json({ message: 'Invalid token' });
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user)                  return res.status(401).json({ message: 'Not authenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: `Access denied — requires role: ${roles.join(' or ')}` });
    next();
  };
}

// Optional auth — doesn't fail if no token
async function optionalAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return next();
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch {}
  next();
}

module.exports = { requireAuth, requireRole, optionalAuth };
